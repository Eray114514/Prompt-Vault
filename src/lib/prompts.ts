import {
  PROMPT_LIMITS,
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

  return {
    ok: true,
    data: {
      title: title.data,
      content: content.data,
      notes: notes.data,
      category: source.category as Category,
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
