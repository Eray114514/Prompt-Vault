"use server";

import { unstable_noStore as noStore } from "next/cache";
import { supabase } from "./supabase";
import { parseNewPrompt } from "./prompts";
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
