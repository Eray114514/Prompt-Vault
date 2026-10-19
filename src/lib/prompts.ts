import {
  PROMPT_LIMITS,
  hasForbiddenModelChars,
  isValidCategory,
  VALID_CATEGORIES,
  type Category,
  type NewPrompt,
  type Prompt,
} from "./types";

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function parseTags(value: unknown): ParseResult<string[]> {
  if (value === undefined || value === null) return { ok: true, data: [] };
  if (!Array.isArray(value)) return { ok: false, error: "tags 必须是字符串数组" };

  const cleaned: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const tag = item.trim();
    if (!tag) continue;
    if (tag.length > PROMPT_LIMITS.tagLength) {
      return { ok: false, error: `单个标签不能超过 ${PROMPT_LIMITS.tagLength} 个字符` };
    }
    if (!cleaned.includes(tag)) cleaned.push(tag);
  }

  if (cleaned.length > PROMPT_LIMITS.tagCount) {
    return { ok: false, error: `标签数量不能超过 ${PROMPT_LIMITS.tagCount} 个` };
  }
  return { ok: true, data: cleaned };
}

/**
 * 模型名的校验与归一。
 *
 * 归一的目标不是"猜用户想写什么"，而是保证这个值能安全地进 PostgREST 过滤条件：
 * 去掉结构字符和 LIKE 通配符，折叠空白，长度封顶。空字符串是合法值，表示未标注模型。
 */
export function normalizeModelName(value: unknown): ParseResult<string> {
  if (value === undefined || value === null) return { ok: true, data: "" };
  if (typeof value !== "string") {
    return { ok: false, error: "model 必须是字符串" };
  }

  const model = value.replace(/\s+/g, " ").trim();
  if (!model) return { ok: true, data: "" };
  if (model.length > PROMPT_LIMITS.model) {
    return { ok: false, error: `模型名不能超过 ${PROMPT_LIMITS.model} 个字符` };
  }
  if (hasForbiddenModelChars(model)) {
    return {
      ok: false,
      error: `模型名不能包含 , ( ) { } " \\ % * 或控制字符`,
    };
  }
  return { ok: true, data: model };
}

/**
 * 输入框里的宽松版归一：把结构字符直接抹掉、压到长度上限，而不是报错。
 * 服务端仍然用 normalizeModelName 严格校验 —— 这里只是让手动输入更顺，
 * 不承担"信任边界"的职责。
 */
export function sanitizeModelDraft(raw: string): string {
  return raw
    .replace(/["\\,(){}%*]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, PROMPT_LIMITS.model);
}

function parseTextField(
  value: unknown,
  field: string,
  max: number,
  { required }: { required: boolean }
): ParseResult<string> {
  const text = asTrimmedString(value);
  if (text === null) {
    if (required) return { ok: false, error: `${field} 必填且必须是字符串` };
    return { ok: true, data: "" };
  }
  if (required && !text) return { ok: false, error: `${field} 不能为空` };
  if (text.length > max) {
    return { ok: false, error: `${field} 不能超过 ${max} 个字符` };
  }
  return { ok: true, data: text };
}

/**
 * 新建提示词的输入校验。
 *
 * 这是 API route 和 Server Action 共用的同一份实现 —— 之前只有 API 那侧有校验，
 * 走 Web UI 的 Server Action 是直接 insert 的，等于留了个无校验的旁路。
 */
export function parseNewPrompt(body: unknown): ParseResult<NewPrompt> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "请求体必须是 JSON 对象" };
  }

  const source = body as Record<string, unknown>;

  const title = parseTextField(source.title, "title", PROMPT_LIMITS.title, {
    required: true,
  });
  if (!title.ok) return title;

  const content = parseTextField(source.content, "content", PROMPT_LIMITS.content, {
    required: true,
  });
  if (!content.ok) return content;

  const notes = parseTextField(source.notes, "notes", PROMPT_LIMITS.notes, {
    required: false,
  });
  if (!notes.ok) return notes;

  if (!isValidCategory(source.category)) {
    return {
      ok: false,
      error: `category 必填，且必须是以下之一：${VALID_CATEGORIES.join(", ")}`,
    };
  }

  const tags = parseTags(source.tags);
  if (!tags.ok) return tags;

  const model = normalizeModelName(source.model);
  if (!model.ok) return model;

  return {
    ok: true,
    data: {
      title: title.data,
      content: content.data,
      notes: notes.data,
      category: source.category as Category,
      model: model.data,
      tags: tags.data,
    },
  };
}

/** UI 与服务端共用的排序：最近创建的在前。 */
export function sortByCreatedDesc(list: Prompt[]): Prompt[] {
  return [...list].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export interface TagCount {
  tag: string;
  count: number;
}

/**
 * 从全量提示词聚合标签及出现次数。
 *
 * 计数降序；同计数用 zh 语音环境比较做兜底 —— 否则标签顺序会随插入顺序抖动，
 * 侧栏看起来像在乱跳。计数口径始终是全量，与分类计数一致（侧栏是稳定的导航面，
 * 让它随筛选变化会让人困惑）。
 */
export function aggregateTags(prompts: Prompt[]): TagCount[] {
  const counts = new Map<string, number>();

  for (const prompt of prompts) {
    for (const raw of prompt.tags) {
      const tag = raw.trim();
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts, ([tag, count]) => ({ tag, count })).sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh")
  );
}

export interface ModelCount {
  /** 首次出现时的原写法。展示用它，匹配一律大小写不敏感。 */
  model: string;
  count: number;
  /** 这个模型出现在哪些分类里 —— 给 API 文档用，方便 agent 知道该查哪个 category。 */
  categories: Category[];
}

/**
 * 聚合模型及使用次数。
 *
 * 与标签不同的两点：
 * - 空字符串（未标注）不参与聚合 —— "不限模型"不是一个模型，列出来只会污染清单。
 * - 大小写不敏感地合并（`Midjourney` / `midjourney` 算同一个），显示保留首次出现的写法。
 *   模型名是 agent 和手输共用的自由文本，只差大小写的两个变体是最常见的脏数据。
 */
export function aggregateModels(
  list: Array<Pick<Prompt, "model" | "category">>
): ModelCount[] {
  const byKey = new Map<string, { model: string; count: number; categories: Set<Category> }>();

  for (const prompt of list) {
    const model = (prompt.model ?? "").trim();
    if (!model) continue;
    const key = model.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      existing.categories.add(prompt.category);
    } else {
      byKey.set(key, {
        model,
        count: 1,
        categories: new Set<Category>([prompt.category]),
      });
    }
  }

  return Array.from(byKey.values())
    .map((entry) => ({
      model: entry.model,
      count: entry.count,
      categories: Array.from(entry.categories),
    }))
    .sort(
      (a, b) => b.count - a.count || a.model.localeCompare(b.model, "zh")
    );
}

/** 模型筛选：空筛选视为全部命中；否则大小写不敏感地精确相等。 */
export function matchesModel(prompt: Pick<Prompt, "model">, model: string): boolean {
  const target = model.trim().toLowerCase();
  if (!target) return true;
  return (prompt.model ?? "").trim().toLowerCase() === target;
}

/**
 * 标签筛选语义：多选之间是 AND —— 一条提示词必须**同时**含全部选中标签。
 *
 * 理由：单条提示词内的 tags 本来就是一个 AND 集合，加第二个标签的直觉是"收窄"；
 * 想放宽用分类或搜索即可。这个语义也能直译为 PostgREST 的 tags=cs.{a,b}。
 */
export function matchesTags(prompt: Prompt, selectedTags: string[]): boolean {
  if (selectedTags.length === 0) return true;
  const owned = new Set(prompt.tags.map((tag) => tag.trim().toLowerCase()));
  return selectedTags.every((tag) => owned.has(tag.trim().toLowerCase()));
}
