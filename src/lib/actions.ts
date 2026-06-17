"use server";

import { unstable_noStore as noStore } from "next/cache";
import { supabase } from "./supabase";
import type { NewPrompt, Prompt } from "./types";

export async function getPrompts(): Promise<Prompt[]> {
  noStore();
  const { data, error } = await supabase
    .from("prompts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Prompt[];
}

export async function createPrompt(data: NewPrompt): Promise<Prompt> {
  const { data: result, error } = await supabase
    .from("prompts")
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return result as Prompt;
}

export async function updatePrompt(
  id: string,
  data: Partial<NewPrompt>
): Promise<Prompt> {
  const { data: result, error } = await supabase
    .from("prompts")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return result as Prompt;
}

export async function deletePrompt(id: string): Promise<void> {
  const { error } = await supabase.from("prompts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function toggleFavorite(
  id: string,
  is_favorite: boolean
): Promise<void> {
  const { error } = await supabase
    .from("prompts")
    .update({ is_favorite, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
