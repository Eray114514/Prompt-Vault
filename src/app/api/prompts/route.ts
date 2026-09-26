export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { constantTimeEqual } from "@/lib/auth";
import { parseNewPrompt } from "@/lib/prompts";
import {
  MAX_FAVORITES_RETURNED,
  MAX_TAG_FILTER,
  PROMPT_LIMITS,
  VALID_CATEGORIES,
  isValidCategory,
} from "@/lib/types";

/**
 * 鉴权策略（刻意如此，改动前请先读这段）：
 *
 * - GET 完全公开，不需要任何密钥 —— 目的就是让任意云端的 agent 在任何地方都能直接取用。
 *   代价是内容公开可读，这是明确接受的取舍。
 * - POST 一律需要 `Authorization: Bearer <API_SECRET>`。没配置 API_SECRET 时整个写接口
 *   直接返回 503，而不是"退化成无鉴权"—— 写入侧不允许存在任何裸奔路径。
 * - 两侧都带 `X-Robots-Tag: noindex`，配合全站 robots.txt，避免公开内容被搜索引擎收录。
 */

const NOINDEX = "noindex, nofollow, noarchive, nosnippet, noimageindex";

function baseHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-Robots-Tag": NOINDEX,
  };
}

function jsonResponse(body: unknown, status = 200, cacheSeconds = 0) {
  const headers = baseHeaders();
  headers["Cache-Control"] =
    cacheSeconds > 0
      ? `public, s-maxage=${cacheSeconds}, stale-while-revalidate=300`
      : "no-store, must-revalidate";
  return NextResponse.json(body, { status, headers });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** 先哈希再比，两边长度恒为 64，比较过程不泄露长度或前缀信息。 */
async function secretMatches(provided: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256Hex(provided), sha256Hex(expected)]);
  return constantTimeEqual(a, b);
}

/**
 * 把用户输入整理成能安全嵌进 PostgREST `or=(...)` 的字面量。
 *
 * 这里做的是"剔除"而不是"转义"。原因：or 语法里 , ( ) { } " \ 都是结构字符，
 * 而 LIKE 自己还有一层反斜杠转义，两层叠加极易出错（`\\%` 到底是字面反斜杠还是通配符）。
 * 搜索词本来就应该接近人话，直接把这些字符换成空格，行为可预测得多；
 * 剩下的字符（含 . - 空格 等）整体用双引号包住，就不会被解析成语法。
 */
function sanitizeSearchTerm(raw: string): string | null {
  const cleaned = raw
    .replace(/["\\,(){}%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function buildOrFilter(raw: string): string | null {
  const cleaned = sanitizeSearchTerm(raw);
  if (!cleaned) return null;
  const like = `"%${cleaned}%"`;
  const contains = `"{${cleaned}}"`;
  return [
    `title.ilike.${like}`,
    `content.ilike.${like}`,
    `notes.ilike.${like}`,
    `tags.cs.${contains}`,
  ].join(",");
}

type ApiPromptRow = {
  title: string;
  content: string;
  notes: string;
  category?: string;
  tags: string[];
  is_favorite: boolean;
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: baseHeaders() });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawCategories = searchParams.getAll("category");
  const categories =
    rawCategories.length > 0 ? rawCategories : ["image_generation"];
  const q = searchParams.get("q")?.trim() ?? "";

  // 可重复的 tag= 参数。多选之间是 AND（必须同时含全部标签）。
  // 未知标签只会命中 0 条，不报 400 —— 标签是自由文本，没有"合法值"可言。
  const selectedTags = Array.from(
    new Set(
      searchParams
        .getAll("tag")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0 && tag.length <= PROMPT_LIMITS.tagLength)
    )
  ).slice(0, MAX_TAG_FILTER);

  const limitParam = searchParams.get("limit");
  const parsedLimit = Number.parseInt(limitParam ?? "10", 10);
  const limit = Math.min(
    Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 10, 1),
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

  const includeCategory = rawCategories.length > 1;
  // 显式标注为 string，让 supabase 的类型层走通用分支，行类型交给下面的
  // .returns<ApiPromptRow[]>() 决定。否则 select() 在编译期的 SQL 解析器
  // 会在两个字符串字面量的联合类型上翻车（ParserError）。
  const selectColumns: string = includeCategory
    ? "title,content,notes,category,tags,is_favorite"
    : "title,content,notes,tags,is_favorite";

  const orFilter = q ? buildOrFilter(q) : null;

  const buildQuery = (favorite: boolean) => {
    const base = supabase
      .from("prompts")
      .select(selectColumns)
      .eq("is_favorite", favorite)
      .in("category", categories);

    // 标签过滤用 .contains()（生成 tags=cs.{a,b}）而不是手拼 or 字符串：
    // 转义交给 supabase-js，而且它与下面 q 的 or 组在顶层天然 AND、互不干扰。
    const scoped =
      selectedTags.length > 0 ? base.contains("tags", selectedTags) : base;
    const filtered = orFilter ? scoped.or(orFilter) : scoped;
    return filtered
      .order("updated_at", { ascending: false })
      .returns<ApiPromptRow[]>();
  };

  // 分页下推到 SQL。
  // 旧实现是把整个分类拉进 Edge 函数再 slice —— 而 PostgREST 单次最多返回 1000 行，
  // 超限是静默截断，于是"翻页"和"搜索"都会在数据变多后悄悄漏结果且不报错。
  const [favoritesResult, nonFavoritesResult] = await Promise.all([
    buildQuery(true).range(0, MAX_FAVORITES_RETURNED - 1),
    buildQuery(false).range(0, limit - 1),
  ]);

  const errorMessage =
    favoritesResult.error?.message ?? nonFavoritesResult.error?.message;
  if (errorMessage) {
    return jsonResponse({ error: errorMessage }, 500);
  }

  const favorites = favoritesResult.data ?? [];
  const nonFavorites = nonFavoritesResult.data ?? [];

  return jsonResponse(
    {
      data: [...favorites, ...nonFavorites],
      meta: {
        favoritesReturned: favorites.length,
        nonFavoritesReturned: nonFavorites.length,
        nonFavoritesLimit: limit,
        favoritesLimit: MAX_FAVORITES_RETURNED,
        categories,
        q: q || null,
        tags: selectedTags,
      },
    },
    200,
    30
  );
}

export async function POST(request: NextRequest) {
  const expectedSecret = (process.env.API_SECRET ?? "").trim();

  // 没有配置就直接拒绝服务，绝不退化成"无鉴权可写"。
  if (!expectedSecret) {
    return jsonResponse(
      {
        error:
          "Write API is disabled: API_SECRET is not configured on the server.",
      },
      503
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!provided || !(await secretMatches(provided, expectedSecret))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const parsed = parseNewPrompt(body);
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, 400);
  }

  const { data, error } = await supabase
    .from("prompts")
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ data }, 201);
}
