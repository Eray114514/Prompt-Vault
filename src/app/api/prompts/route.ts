export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { NewPrompt } from "@/lib/types";

const VALID_CATEGORIES = [
  "image_generation",
  "image_editing",
  "video_generation",
  "llm_chat",
] as const;

type ValidCategory = (typeof VALID_CATEGORIES)[number];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function cacheHeaders() {
  return {
    ...corsHeaders(),
    "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
  };
}

function jsonResponse(body: unknown, status = 200, useCache = false) {
  return NextResponse.json(body, {
    status,
    headers: useCache ? cacheHeaders() : corsHeaders(),
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function isValidCategory(value: unknown): value is ValidCategory {
  return (
    typeof value === "string" &&
    VALID_CATEGORIES.includes(value as ValidCategory)
  );
}

function matchQuery(
  prompt: {
    title: string;
    content: string;
    notes?: string | null;
    tags: string[];
  },
  q: string
) {
  const lower = q.toLowerCase();
  return (
    prompt.title.toLowerCase().includes(lower) ||
    prompt.content.toLowerCase().includes(lower) ||
    (prompt.notes ?? "").toLowerCase().includes(lower) ||
    prompt.tags.some((tag) => tag.toLowerCase().includes(lower))
  );
}

type ApiPromptRow = {
  title: string;
  content: string;
  notes: string;
  category: string;
  tags: string[];
  is_favorite: boolean;
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawCategories = searchParams.getAll("category");
  const categories =
    rawCategories.length > 0 ? rawCategories : ["image_generation"];
  const q = searchParams.get("q")?.trim();
  const limitParam = searchParams.get("limit");
  const limit = Math.min(
    Math.max(parseInt(limitParam ?? "10", 10) || 10, 1),
    100
  );

  const invalidCategories = categories.filter((c) => !isValidCategory(c));
  if (invalidCategories.length > 0) {
    return jsonResponse(
      {
        error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
      },
      400
    );
  }

  const buildQuery = (isFavorite: boolean) =>
    supabase
      .from("prompts")
      .select("title,content,notes,category,tags,is_favorite")
      .eq("is_favorite", isFavorite)
      .in("category", categories)
      .order("updated_at", { ascending: false })
      .returns<ApiPromptRow[]>();

  const [
    { data: favorites, error: favError },
    { data: nonFavorites, error: nonFavError },
  ] = await Promise.all([buildQuery(true), buildQuery(false)]);

  if (favError || nonFavError) {
    return jsonResponse(
      { error: favError?.message ?? nonFavError?.message },
      500
    );
  }

  const allFavorites = (favorites ?? []).filter((p) => !q || matchQuery(p, q));
  const nonFavoritesToReturn = (nonFavorites ?? [])
    .filter((p) => !q || matchQuery(p, q))
    .slice(0, limit);

  return jsonResponse(
    {
      data: [...allFavorites, ...nonFavoritesToReturn],
      meta: {
        favoritesReturned: allFavorites.length,
        nonFavoritesReturned: nonFavoritesToReturn.length,
        nonFavoritesLimit: limit,
        categories,
        q: q ?? null,
      },
    },
    200,
    true
  );
}

export async function POST(request: NextRequest) {
  const apiSecret = process.env.API_SECRET;
  if (apiSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${apiSecret}`) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  let body: Partial<NewPrompt>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { title, content, notes, category, tags } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return jsonResponse({ error: "title is required" }, 400);
  }
  if (!content || typeof content !== "string" || !content.trim()) {
    return jsonResponse({ error: "content is required" }, 400);
  }
  if (!isValidCategory(category)) {
    return jsonResponse(
      {
        error: `category is required and must be one of: ${VALID_CATEGORIES.join(", ")}`,
      },
      400
    );
  }

  const payload: NewPrompt = {
    title: title.trim(),
    content: content.trim(),
    notes: typeof notes === "string" ? notes.trim() : "",
    category,
    tags: Array.isArray(tags)
      ? tags.filter((tag): tag is string => typeof tag === "string")
      : [],
  };

  const { data, error } = await supabase
    .from("prompts")
    .insert(payload)
    .select()
    .single();

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ data }, 201);
}
