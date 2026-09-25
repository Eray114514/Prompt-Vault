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
} as const;

/** 单次 GET 请求最多返回的收藏条目数，防止收藏区无限膨胀拖垮响应。 */
export const MAX_FAVORITES_RETURNED = 200;

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
