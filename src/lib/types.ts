export type Category =
  | "image_generation"
  | "image_editing"
  | "video_generation"
  | "llm_chat";

/**
 * 分类的唯一事实来源。
 *
 * 之前这份数组在 API route 里被手抄了一遍，AGENTS.md 还专门写了条"记得同步"——
 * 需要靠人记住的同步规则早晚会失效。现在路由、Server Action、类型守卫都从这里取。
 * 数据库那侧的 check constraint 仍需要手动迁移（见 README）。
 */
export const VALID_CATEGORIES = [
  "image_generation",
  "image_editing",
  "video_generation",
  "llm_chat",
] as const;

export function isValidCategory(value: unknown): value is Category {
  return (
    typeof value === "string" &&
    (VALID_CATEGORIES as readonly string[]).includes(value)
  );
}

/** 写入校验的边界。宽松到不会误伤真实数据，但足以挡住异常输入。 */
export const PROMPT_LIMITS = {
  title: 200,
  content: 20000,
  notes: 5000,
  tagCount: 24,
  tagLength: 50,
  /** 模型名是短标签，不是描述；60 字符足够放下 "Claude 3.5 Sonnet latest" 这类长名字。 */
  model: 60,
} as const;

/**
 * 模型名里不允许出现的字符。
 *
 * 模型名会被原样带进 PostgREST 的过滤条件（`model=ilike.<值>`），而 `,` `(` `)`
 * `{` `}` 在 PostgREST 里是逻辑树的语法字符，`%` `*` 是 LIKE 通配符。
 * 和搜索词一样，这里选择"写入时剔除"而不是"查询时层层转义" —— 模型名是给人看的
 * 短标签，不需要这些字符，剔除之后整条链路的行为都可预测。
 */
const MODEL_FORBIDDEN_PATTERN = /["\\,(){}%*]/;

export function hasForbiddenModelChars(value: string): boolean {
  return MODEL_FORBIDDEN_PATTERN.test(value) || /[\u0000-\u001f\u007f]/.test(value);
}

/** 单次 GET 请求最多返回的收藏条目数，防止收藏区无限膨胀拖垮响应。 */
export const MAX_FAVORITES_RETURNED = 200;

/**
 * 指定模型查询时，附带返回的"标题目录"上限。
 *
 * 目录只带标题 / 模型 / 分类 / 是否收藏 —— 用途是让 agent 知道"还有这些提示词存在"，
 * 真要看再用 q=标题 精确取正文。所以它不该大到变成第二次全量返回。
 */
export const MAX_CATALOG_RETURNED = 50;

/** 单次请求最多接受多少个 tag 过滤条件（多选之间是 AND）。 */
export const MAX_TAG_FILTER = 8;

/**
 * Server Action 的返回值约定。
 *
 * 刻意用"返回"而不是"抛异常"：Next.js 在生产环境会把 Server Action 抛出的错误信息
 * 统一替换成通用文案（只保留 digest），所以只有返回的错误才能可靠地显示到界面上。
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type FilterKey = "all" | "favorites" | Category;


export interface Prompt {
  id: string;
  title: string;
  content: string;
  notes: string;
  category: Category;
  /**
   * 这条提示词面向的模型（Midjourney / GPT-4o / Nano Banana …）。
   * 空字符串 = 未标注，表示"不限模型"。它是独立字段而不是特殊标签：
   * 标签是平权的多值集合，模型需要单值、需要排在其他标签前面、也需要 API 单独过滤。
   */
  model: string;
  tags: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewPrompt {
  title: string;
  content: string;
  notes: string;
  category: Category;
  model: string;
  tags: string[];
}

export interface CategoryInfo {
  value: FilterKey;
  label: string;
  icon: string;
}

// 分类选项（用于新建/编辑时选择，value 仅为四大分类）
export interface CategoryOption {
  value: Category;
  label: string;
  icon: string;
}

// 侧边栏导航项：全部 + 收藏 + 四个分类
export const NAV_ITEMS: CategoryInfo[] = [
  { value: "all", label: "全部", icon: "all" },
  { value: "favorites", label: "收藏", icon: "star" },
  { value: "image_generation", label: "图片生成", icon: "image" },
  { value: "image_editing", label: "图片编辑", icon: "edit" },
  { value: "video_generation", label: "视频生成", icon: "video" },
  { value: "llm_chat", label: "AI 对话", icon: "chat" },
];

// 仅四个分类（用于新建时选择）
export const CATEGORIES: CategoryOption[] = [
  { value: "image_generation", label: "图片生成", icon: "image" },
  { value: "image_editing", label: "图片编辑", icon: "edit" },
  { value: "video_generation", label: "视频生成", icon: "video" },
  { value: "llm_chat", label: "AI 对话", icon: "chat" },
];

export const CATEGORY_LABELS: Record<Category, string> = {
  image_generation: "图片生成",
  image_editing: "图片编辑",
  video_generation: "视频生成",
  llm_chat: "AI 对话",
};

// 分类霓虹色
export const CATEGORY_COLORS: Record<Category, string> = {
  image_generation: "#ff6b35",
  image_editing: "#00d9ff",
  video_generation: "#ff006e",
  llm_chat: "#caff00",
};

export function categoryColor(category: Category): string {
  return CATEGORY_COLORS[category];
}
