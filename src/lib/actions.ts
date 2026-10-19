"use server";

import { unstable_noStore as noStore } from "next/cache";
import { supabase } from "./supabase";
import { aggregateModels, parseNewPrompt, type ModelCount } from "./prompts";
import { requireSession } from "./session";
import type { ActionResult, NewPrompt, Prompt } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertId(id: unknown): string | null {
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) return null;
  return id;
}

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

  const promptId = assertId(id);
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

  const promptId = assertId(id);
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

  const promptId = assertId(id);
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

/** 客户端在乐观更新后用来把本地顺序校准回服务端顺序。 */
