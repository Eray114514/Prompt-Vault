export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  bearerToken,
  configuredSecrets,
  matchesAnySecret,
} from "@/lib/api-auth";
import type { Prompt } from "@/lib/types";

/**
 * 整库导出，用于备份。
 *
 * 与 GET /api/prompts 的姿态**不同**：那边是刻意公开的，这边是整库 dump，
 * 必须鉴权。所以：
 * - 接受 API_SECRET 或 CRON_SECRET（Vercel Cron 会自动带上后者）。
 * - 两个都没配置 → 503，绝不退化成公开。
 * - 不发 Access-Control-Allow-Origin —— 整库 dump 不该跨域可读。
 *
 * 注意：route 已加入 middleware 的 matcher 白名单。它是"公开可达"的，
 * 安全性完全由下面的 503/401 承担，改这里前先读一遍 middleware。
 */

const PAGE_SIZE = 1000;
/** 防御性上限：50 页 = 5 万条。避免分页循环因为意外的返回值而无限转。 */
const MAX_PAGES = 50;

const NOINDEX = "noindex, nofollow, noarchive, nosnippet, noimageindex";

function jsonResponse(body: unknown, status: number, extra?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, must-revalidate",
      "X-Robots-Tag": NOINDEX,
      ...extra,
    },
  });
}

/**
 * 分页取全量。
 *
 * 必须循环：PostgREST 单次最多返回 1000 行且超限**静默截断** ——
 * 直接 select("*") 会让备份悄悄少数据，而这恰恰是最不该出错的场景。
 */
async function fetchAllPrompts(): Promise<Prompt[] | null> {
  const all: Prompt[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const offset = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("prompts")
      .select("*")
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) return null;

    const rows = (data ?? []) as Prompt[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }

  return all;
}

/** 内容里可能自带 ```，所以按最长连续反引号动态加长围栏，避免把文档结构撑破。 */
function fenceFor(content: string): string {
  const runs = content.match(/`{3,}/g);
  const longest = runs ? Math.max(...runs.map((run) => run.length)) : 2;
  return "`".repeat(Math.max(3, longest + 1));
}

function toMarkdown(prompts: Prompt[], includeNotes: boolean): string {
  const lines: string[] = [
    "# Prompt Vault 导出",
    "",
    `导出时间：${new Date().toISOString()}`,
    `条目数：${prompts.length}`,
    "",
    "---",
    "",
  ];

  for (const prompt of prompts) {
    lines.push(`## ${prompt.title}`, "");
    lines.push(`- 分类：\`${prompt.category}\`${prompt.is_favorite ? "（收藏）" : ""}`);
    if (prompt.tags.length > 0) {
      lines.push(`- 标签：${prompt.tags.map((tag) => `\`${tag}\``).join(" ")}`);
    }
    lines.push(`- 创建：${prompt.created_at}`, "");

    if (includeNotes && prompt.notes?.trim()) {
      lines.push("**备注**", "", prompt.notes, "");
    }

    const fence = fenceFor(prompt.content);
    lines.push(fence, prompt.content, fence, "");
  }

  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  const secrets = configuredSecrets("API_SECRET", "CRON_SECRET");

  // 没有配置任何密钥就直接拒绝服务，绝不让整库 dump 变成公开端点。
  if (secrets.length === 0) {
    return jsonResponse(
      {
        error:
          "Export API is disabled: neither API_SECRET nor CRON_SECRET is configured on the server.",
      },
      503
    );
  }

  if (!(await matchesAnySecret(bearerToken(request), secrets))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const prompts = await fetchAllPrompts();
  if (prompts === null) {
    return jsonResponse({ error: "Failed to read prompts" }, 500);
  }

  const format = request.nextUrl.searchParams.get("format") ?? "json";
  const includeNotes = request.nextUrl.searchParams.get("notes") !== "0";
  const exportedAt = new Date().toISOString();

  if (format === "md" || format === "markdown") {
    return new NextResponse(toMarkdown(prompts, includeNotes), {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "no-store, must-revalidate",
        "X-Robots-Tag": NOINDEX,
        "Content-Disposition": 'attachment; filename="prompt-vault-export.md"',
      },
    });
  }

  const payload = {
    exportedAt,
    count: prompts.length,
    data: includeNotes
      ? prompts
      : prompts.map(({ notes: _notes, ...rest }) => rest),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, must-revalidate",
      "X-Robots-Tag": NOINDEX,
      "Content-Disposition": 'attachment; filename="prompt-vault-export.json"',
    },
  });
}
