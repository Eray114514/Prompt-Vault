export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { jsonResponse } from "@/lib/api-response";
import { VALID_CATEGORIES, isValidCategory } from "@/lib/types";

/**
 * 标签总览：给 agent 用的"写之前先查一眼"接口。
 *
 * 为什么需要它：POST 之前要挑标签，但标签是自由文本，没有枚举可查。
 * 以前只能把整个库拉下来自己数 —— 那等于为了加一条提示词读了一整库。
 * 这个端点只回 `tag + count`，属于元数据，不涉及任何提示词正文。
 *
 * 姿态与 GET /api/prompts 一致：公开、可跨域、noindex。它列出的标签本来
 * 就能从公开的 GET 里推出来，所以不构成额外泄露面。
 *
 * 注意：route 必须留在 middleware 的白名单里，否则没有会话 cookie 的 agent
 * 会拿到 307 而不是结果。
 */

const PAGE_SIZE = 1000;
/** 防御性上限：50 页 = 5 万条。避免分页循环因意外返回值无限转。 */
const MAX_PAGES = 50;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

type TagRow = { tags: string[] | null };

type TagCount = { tag: string; count: number };

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const rawCategories = searchParams.getAll("category");
  const categories =
    rawCategories.length > 0 ? rawCategories : [...VALID_CATEGORIES];

  const invalidCategories = categories.filter((c) => !isValidCategory(c));
  if (invalidCategories.length > 0) {
    return jsonResponse(
      {
        error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
      },
      400
    );
  }

  // 子串匹配，用于确认"是不是已经有类似标签了"（例如 q=post 命中 poster）。
  // 大小写不敏感；纯过滤，不参与聚合。
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Math.min(
    Math.max(Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );

  /**
   * 大小写不敏感地合并：`Poster` 与 `poster` 视为同一个标签，
   * 显示时保留第一次遇到的原写法。agent 最容易干的事就是造出只差大小写的近义标签。
   */
  const byKey = new Map<string, TagCount>();
  let promptCount = 0;
  let complete = true;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const offset = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("prompts")
      .select("tags")
      .in("category", categories)
      // 分页必须有确定性排序，否则 offset 翻页会重复或漏行。
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
      .returns<TagRow[]>();

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    const rows = data ?? [];
    for (const row of rows) {
      for (const raw of row.tags ?? []) {
        const tag = raw.trim();
        if (!tag) continue;
        const key = tag.toLowerCase();
        const existing = byKey.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          byKey.set(key, { tag, count: 1 });
        }
      }
    }

    promptCount += rows.length;
    if (rows.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) complete = false;
  }

  const all = Array.from(byKey.values());
  const matched = q ? all.filter((item) => item.tag.toLowerCase().includes(q)) : all;

  matched.sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "en")
  );

  const data = matched.slice(0, limit);

  return jsonResponse(
    {
      data,
      meta: {
        /** 去重后的标签总数（q 过滤之后） */
        total: matched.length,
        /** 本次实际返回条数 */
        returned: data.length,
        limit,
        /** 参与统计的提示词条数 */
        promptCount,
        categories,
        q: q || null,
        /** false 表示超出 MAX_PAGES 没扫完，结果可能不全 */
        complete,
      },
    },
    200,
    30
  );
}
