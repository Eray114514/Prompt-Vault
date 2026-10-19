import { NextResponse } from "next/server";

/**
 * 公开只读 JSON 端点共用的响应工具。
 *
 * 抽出来是因为 /api/prompts 和 /api/tags 是同一套姿态：公开、可跨域、noindex、
 * 默认不缓存。两处各写一份迟早会漂移 —— 比如只给其中一个加了 noindex。
 */

export const NOINDEX = "noindex, nofollow, noarchive, nosnippet, noimageindex";

export function baseHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-Robots-Tag": NOINDEX,
  };
}

export function jsonResponse(body: unknown, status = 200, cacheSeconds = 0) {
  const headers = baseHeaders();
  headers["Cache-Control"] =
    cacheSeconds > 0
      ? `public, s-maxage=${cacheSeconds}, stale-while-revalidate=300`
      : "no-store, must-revalidate";
  return NextResponse.json(body, { status, headers });
}
