"use server";

import { unstable_noStore as noStore } from "next/cache";
import { supabase } from "./supabase";
import {
  aggregateModels,
  normalizeModelName,
  normalizePromptId,
  parseNewPrompt,
  type ModelCount,
} from "./prompts";
import { requireSession } from "./session";
import type { ActionResult, NewPrompt, Prompt } from "./types";

const PROMPTS_PAGE_SIZE = 1000;
/** 防御性上限：50 页 = 5 万条，避免分页循环因为意外返回值而无限转。 */
const PROMPTS_MAX_PAGES = 50;

export async function getPrompts(): Promise<Prompt[]> {
  noStore();

  // 必须分页取全量：PostgREST 单次最多返回 1000 行，超限是**静默截断** ——
  // 直接 .select("*") 会让界面在库破千之后悄悄少数据，而且不报任何错。
  const all: Prompt[] = [];

  for (let page = 0; page < PROMPTS_MAX_PAGES; page += 1) {
    const offset = page * PROMPTS_PAGE_SIZE;
    const { data, error } = await supabase
      .from("prompts")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + PROMPTS_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Prompt[];
    all.push(...rows);
    if (rows.length < PROMPTS_PAGE_SIZE) break;
  }

  return all;
}

/**
 * 只取 model + category 两列的聚合，供 API 文档页展示"本库已有模型"。
 *
 * 文档页把这份清单直接写进给 agent 的指令包里，agent 因此不需要先调接口
 * 才能知道有哪些模型名可用 —— 少一次往返，也少一次"模型名猜错"的机会。
 */
export async function getModelCatalog(): Promise<ModelCount[]> {
  noStore();

  const rows: Array<Pick<Prompt, "model" | "category">> = [];

  for (let page = 0; page < PROMPTS_MAX_PAGES; page += 1) {
    const offset = page * PROMPTS_PAGE_SIZE;
    const { data, error } = await supabase
      .from("prompts")
      .select("model,category")
      // 分页必须有确定性排序，否则 offset 翻页会重复或漏行。
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PROMPTS_PAGE_SIZE - 1)
      .returns<Array<Pick<Prompt, "model" | "category">>>();

    if (error) throw new Error(error.message);

    const pageRows = data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < PROMPTS_PAGE_SIZE) break;
  }

  return aggregateModels(rows);
}

export async function createPrompt(input: unknown): Promise<ActionResult<Prompt>> {
  await requireSession();

  const parsed = parseNewPrompt(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const payload: NewPrompt = parsed.data;
  const { data, error } = await supabase
    .from("prompts")
    .insert(payload)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as Prompt };
}

export async function updatePrompt(
  id: unknown,
  input: unknown
): Promise<ActionResult<Prompt>> {
  await requireSession();

  const promptId = normalizePromptId(id);
  if (!promptId) return { ok: false, error: "无效的 id" };

  const parsed = parseNewPrompt(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const { data, error } = await supabase
    .from("prompts")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", promptId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as Prompt };
}

export async function deletePrompt(id: unknown): Promise<ActionResult<null>> {
  await requireSession();

  const promptId = normalizePromptId(id);
  if (!promptId) return { ok: false, error: "无效的 id" };

  const { error } = await supabase.from("prompts").delete().eq("id", promptId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function toggleFavorite(
  id: unknown,
  isFavorite: unknown
): Promise<ActionResult<null>> {
  await requireSession();

  const promptId = normalizePromptId(id);
  if (!promptId) return { ok: false, error: "无效的 id" };

  const { error } = await supabase
    .from("prompts")
    .update({
      is_favorite: Boolean(isFavorite),
      updated_at: new Date().toISOString(),
    })
    .eq("id", promptId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// ── 批量操作 ──────────────────────────────────────────────────────────────

/** 单次批量操作的条数上限。超过这个量级应该走导出/迁移，而不是点按钮。 */
const MAX_BULK_IDS = 2000;
/**
 * 每个 UPDATE 请求带多少个 id。
 *
 * id 是拼在 PostgREST 的 `id=in.(...)` 查询串里的，2000 个 UUID 会顶到 70KB+，
 * 超过网关的 URL 上限。分块既避开长度限制，也让单条 SQL 保持可计划的规模。
 */
const BULK_CHUNK_SIZE = 100;

function parseBulkIds(
  value: unknown
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: false, error: "ids 必须是数组" };

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    const id = normalizePromptId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  if (ids.length === 0) return { ok: false, error: "没有有效的 id" };
  if (ids.length > MAX_BULK_IDS) {
    return { ok: false, error: `单次最多操作 ${MAX_BULK_IDS} 条` };
  }
  return { ok: true, ids };
}

/**
 * 分块应用同一个 patch。
 *
 * 中途失败时返回"已经改了多少"而不是假装无事发生 —— 前面的块已经落库了，
 * 客户端必须知道该刷新，而不是继续拿旧状态做判断。
 */
async function applyBulkPatch(
  ids: string[],
  patch: Record<string, unknown>
): Promise<
  { ok: true; updated: number } | { ok: false; updated: number; error: string }
> {
  let updated = 0;

  for (let offset = 0; offset < ids.length; offset += BULK_CHUNK_SIZE) {
    const chunk = ids.slice(offset, offset + BULK_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("prompts")
      .update(patch)
      .in("id", chunk)
      .select("id");

    if (error) return { ok: false, updated, error: error.message };
    updated += data?.length ?? 0;
  }

  return { ok: true, updated };
}

/** 批量设置模型。空字符串表示清空模型（变成"不限模型"）。 */
export async function bulkSetModel(
  ids: unknown,
  model: unknown
): Promise<ActionResult<{ updated: number; model: string }>> {
  await requireSession();

  const parsedIds = parseBulkIds(ids);
  if (!parsedIds.ok) return parsedIds;

  const parsedModel = normalizeModelName(model);
  if (!parsedModel.ok) return { ok: false, error: parsedModel.error };

  const result = await applyBulkPatch(parsedIds.ids, {
    model: parsedModel.data,
    updated_at: new Date().toISOString(),
  });

  if (!result.ok) {
    return {
      ok: false,
      error: `已更新 ${result.updated} 条后失败：${result.error}`,
    };
  }

  return {
    ok: true,
    data: { updated: result.updated, model: parsedModel.data },
  };
}

/** 批量收藏 / 取消收藏。 */
export async function bulkSetFavorite(
  ids: unknown,
  isFavorite: unknown
): Promise<ActionResult<{ updated: number; isFavorite: boolean }>> {
  await requireSession();

  if (typeof isFavorite !== "boolean") {
    return { ok: false, error: "isFavorite 必须是布尔值" };
  }

  const parsedIds = parseBulkIds(ids);
  if (!parsedIds.ok) return parsedIds;

  const result = await applyBulkPatch(parsedIds.ids, {
    is_favorite: isFavorite,
    updated_at: new Date().toISOString(),
  });

  if (!result.ok) {
    return {
      ok: false,
      error: `已更新 ${result.updated} 条后失败：${result.error}`,
    };
  }

  return { ok: true, data: { updated: result.updated, isFavorite } };
}

/** 客户端在乐观更新后用来把本地顺序校准回服务端顺序。 */
