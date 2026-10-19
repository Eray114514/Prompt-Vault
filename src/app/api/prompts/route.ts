export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { bearerToken, secretMatches } from "@/lib/api-auth";
import { baseHeaders, jsonResponse } from "@/lib/api-response";
import {
  normalizeModelName,
  normalizePromptId,
  parseNewPrompt,
  parsePromptPatch,
} from "@/lib/prompts";
import {
  MAX_CATALOG_RETURNED,
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

// sha256Hex + secretMatches 已抽到 @/lib/api-auth，与 /api/export 共用同一份实现，
// 避免将来改安全策略时只改到一处。

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
    `model.ilike.${like}`,
    `tags.cs.${contains}`,
  ].join(",");
}

type ApiPromptRow = {
  id: string;
  title: string;
  content: string;
  notes: string;
  model: string;
  category: string;
  tags: string[];
  is_favorite: boolean;
};

/** 目录条目：只带"有没有、是什么"，不带正文。agent 据此决定要不要精确回查。 */
type CatalogEntry = {
  id: string;
  title: string;
  model: string;
  category: string;
  is_favorite: boolean;
};

/** 查询范围：不限模型 / 仅目标模型 / 排除目标模型。 */
type ModelScope = "all" | "match" | "other";

/**
 * GET 与 PATCH 共用的行字段。
 *
 * `id` 必须返回：它是 PATCH 唯一的定位依据，没有 id 的读取接口等于只读。
 */
const PROMPT_COLUMNS =
  "id,title,content,notes,model,category,tags,is_favorite";

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

  /**
   * 模型过滤。空值等于没传；非法字符直接 400 —— 这个值会被带进 PostgREST
   * 的过滤条件（`model=ilike.<值>`），结构字符必须在入口就挡掉。
   * 未知但合法的模型名不报错，走"0 命中 + availableModels"的路径。
   */
  const rawModel = (searchParams.get("model") ?? "").trim();
  let requestedModel = "";
  if (rawModel) {
    const parsedModel = normalizeModelName(rawModel);
    if (!parsedModel.ok) {
      return jsonResponse(
        { error: `Invalid model: ${parsedModel.error}` },
        400
      );
    }
    requestedModel = parsedModel.data;
  }

  // category 现在始终返回：指定模型后一次可能跨多个分类，
  // agent 需要知道每条提示词属于哪一类才能决定怎么用。
  const selectColumns: string = PROMPT_COLUMNS;

  const orFilter = q ? buildOrFilter(q) : null;

  const buildQuery = (favorite: boolean | null, scope: ModelScope = "all") => {
    let query = supabase
      .from("prompts")
      .select(selectColumns, { count: "exact" })
      .in("category", categories);

    if (favorite !== null) query = query.eq("is_favorite", favorite);

    // 标签过滤用 .contains()（生成 tags=cs.{a,b}）而不是手拼 or 字符串：
    // 转义交给 supabase-js，而且它与下面 q 的 or 组在顶层天然 AND、互不干扰。
    if (selectedTags.length > 0) query = query.contains("tags", selectedTags);
    if (scope === "match") query = query.ilike("model", requestedModel);
    if (scope === "other") query = query.not("model", "ilike", requestedModel);
    if (orFilter) query = query.or(orFilter);

    return query
      .order("updated_at", { ascending: false })
      // 确定性次序：updated_at 可能并列，offset 翻页必须再挂一个唯一列。
      .order("id", { ascending: true })
      .returns<ApiPromptRow[]>();
  };

  /**
   * 扫描当前筛选范围内的模型清单。只在目标模型 0 命中时调用 ——
   * 目的是让 agent 猜错模型名时能立刻看到正确写法，而不是只拿到一个空数组。
   */
  const collectAvailableModels = async (): Promise<
    Array<{ model: string; count: number }>
  > => {
    const counts = new Map<string, { model: string; count: number }>();

    for (let page = 0; page < 50; page += 1) {
      const offset = page * 1000;
      const { data, error } = await buildQuery(null).range(offset, offset + 999);
      if (error) break;

      const rows = data ?? [];
      for (const row of rows) {
        const model = (row.model ?? "").trim();
        if (!model) continue;
        const key = model.toLowerCase();
        const existing = counts.get(key);
        if (existing) existing.count += 1;
        else counts.set(key, { model, count: 1 });
      }
      if (rows.length < 1000) break;
    }

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model, "en"))
      .slice(0, 30);
  };

  // ── 未指定模型：保持原有姿态（收藏最多 200 条 + 非收藏 limit 条） ──
  if (!requestedModel) {
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
          model: null,
        },
      },
      200,
      30
    );
  }

  // ── 指定模型：limit 变成总预算，先给目标模型，再用其他模型补足 ──
  //
  // 目标模型的条目按"收藏 → 非收藏"取，超过预算的部分进 catalog；
  // 余量不足时用其他模型补，同样收藏优先，并逐条标记 model_match=false，
  // 让 agent 明确知道"这条不是给这个模型用的"。
  const fetchWindow = limit + MAX_CATALOG_RETURNED;

  const [matchFavoritesResult, matchNonFavoritesResult] = await Promise.all([
    buildQuery(true, "match").range(0, fetchWindow - 1),
    buildQuery(false, "match").range(0, fetchWindow - 1),
  ]);

  const matchError =
    matchFavoritesResult.error?.message ?? matchNonFavoritesResult.error?.message;
  if (matchError) {
    return jsonResponse({ error: matchError }, 500);
  }

  const matchedAll = [
    ...(matchFavoritesResult.data ?? []),
    ...(matchNonFavoritesResult.data ?? []),
  ];
  const matchedTotal =
    (matchFavoritesResult.count ?? 0) + (matchNonFavoritesResult.count ?? 0);

  const dataMatched = matchedAll.slice(0, limit);
  const remaining = Math.max(limit - dataMatched.length, 0);

  const [otherFavoritesResult, otherNonFavoritesResult] = await Promise.all([
    buildQuery(true, "other").range(
      0,
      remaining + MAX_CATALOG_RETURNED - 1
    ),
    buildQuery(false, "other").range(
      0,
      remaining + MAX_CATALOG_RETURNED - 1
    ),
  ]);

  const otherError =
    otherFavoritesResult.error?.message ?? otherNonFavoritesResult.error?.message;
  if (otherError) {
    return jsonResponse({ error: otherError }, 500);
  }

  const otherAll = [
    ...(otherFavoritesResult.data ?? []),
    ...(otherNonFavoritesResult.data ?? []),
  ];
  const dataFill = otherAll.slice(0, remaining);
  const otherTotal =
    (otherFavoritesResult.count ?? 0) + (otherNonFavoritesResult.count ?? 0);

  const data = [
    ...dataMatched.map((row) => ({ ...row, model_match: true })),
    ...dataFill.map((row) => ({ ...row, model_match: false })),
  ];

  // 目录：目标模型的溢出优先，其次才是其他模型的溢出。
  // 只给标题/模型/分类/收藏状态 —— 足够 agent 判断"值不值得回查"，又不至于变成第二次全量。
  const catalogPool = [
    ...matchedAll.slice(dataMatched.length),
    ...otherAll.slice(dataFill.length),
  ];
  const catalog: CatalogEntry[] = catalogPool
    .slice(0, MAX_CATALOG_RETURNED)
    .map((row) => ({
      id: row.id,
      title: row.title,
      model: row.model,
      category: row.category,
      is_favorite: row.is_favorite,
    }));

  const availableModels =
    matchedTotal === 0 ? await collectAvailableModels() : null;
  const totalInScope = matchedTotal + otherTotal;

  return jsonResponse(
    {
      data,
      catalog,
      meta: {
        categories,
        q: q || null,
        tags: selectedTags,
        /** 本次请求指定的模型（大小写按库里的写法无关，匹配不区分大小写）。 */
        model: requestedModel,
        /** 指定模型时，limit 是本次返回的**总条数预算**（含收藏）。 */
        limit,
        returned: data.length,
        favoritesReturned: data.filter((row) => row.is_favorite).length,
        nonFavoritesReturned: data.filter((row) => !row.is_favorite).length,
        /** 目标模型：本次给了几条，库里一共有几条。 */
        modelMatched: { returned: dataMatched.length, total: matchedTotal },
        /** 为了补足预算而混入的其他模型条数（这些条目的 model_match 为 false）。 */
        otherModelsReturned: dataFill.length,
        catalogReturned: catalog.length,
        catalogLimit: MAX_CATALOG_RETURNED,
        /** true 表示目录被截断：还有更多提示词没列出名字，可缩窄 category/tag 再查。 */
        catalogTruncated: totalInScope > data.length + catalog.length,
        totalInScope,
        /** 仅当目标模型 0 命中时出现：当前范围内实际存在的模型名，供改查。 */
        ...(availableModels ? { availableModels } : {}),
      },
    },
    200,
    30
  );
}

/**
 * POST / PATCH 共用的写接口守卫。
 *
 * 返回 null 表示鉴权通过；否则返回应直接发出的响应。语义与旧实现一致：
 * 没配置 API_SECRET 一律 503，绝不退化成"无鉴权可写"。
 */
async function requireApiSecret(request: NextRequest): Promise<Response | null> {
  const expectedSecret = (process.env.API_SECRET ?? "").trim();

  if (!expectedSecret) {
    return jsonResponse(
      {
        error:
          "Write API is disabled: API_SECRET is not configured on the server.",
      },
      503
    );
  }

  const provided = bearerToken(request);
  if (!provided || !(await secretMatches(provided, expectedSecret))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  return null;
}

export async function POST(request: NextRequest) {
  const authFailure = await requireApiSecret(request);
  if (authFailure) return authFailure;

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

/**
 * 修改已有提示词。
 *
 * 设计取舍：
 * - **局部更新**：只写传入的字段，其余保持原样。agent 改一个标签不必先读全文再整体回写，
 *   也就不会因为漏字段把内容清空。
 * - **必须带 id**：id 由 GET 返回。标题可能重名，不能作为定位依据。
 * - **不开放 is_favorite**：收藏是"这条值得优先给 agent 看"的人工信号，
 *   让 agent 自己写会污染模型查询里的补位排序。
 * - **tags 是整体替换**：想追加就先 GET 拿原数组再拼，语义明确、无隐式合并。
 */
export async function PATCH(request: NextRequest) {
  const authFailure = await requireApiSecret(request);
  if (authFailure) return authFailure;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return jsonResponse({ error: "请求体必须是 JSON 对象" }, 400);
  }

  const id = normalizePromptId((body as Record<string, unknown>).id);
  if (!id) {
    return jsonResponse(
      { error: "id 必填，且必须是 GET 返回的提示词 UUID" },
      400
    );
  }

  const parsed = parsePromptPatch(body);
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, 400);
  }

  // 用 select 返回更新后的行，而不是再做一次查询：并发下"改完再读"可能读到别人的改动。
  const { data, error } = await supabase
    .from("prompts")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(`${PROMPT_COLUMNS},updated_at`)
    .returns<Array<ApiPromptRow & { updated_at: string }>>();

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  // 空数组 = id 合法但库里没有这条。不把"不存在"混进 500，agent 才能区分该重试还是该改 id。
  if (!data || data.length === 0) {
    return jsonResponse({ error: "Prompt not found" }, 404);
  }

  return jsonResponse({ data: data[0] }, 200);
}
