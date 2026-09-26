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

export async function getPrompts(): Promise<Prompt[]> {
  noStore();
  const { data, error } = await supabase
    .from("prompts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Prompt[];
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
