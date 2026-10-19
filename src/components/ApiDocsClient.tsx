"use client";

import { useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  MAX_FAVORITES_RETURNED,
} from "@/lib/types";
import {
  CopyIcon,
  CheckIcon,
  ArrowLeftIcon,
  AlertIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
} from "./Icons";

interface ApiDocsClientProps {
  baseUrl: string;
  /**
   * 服务端的 API_SECRET 明文。null 表示未配置（写接口会 503）。
   *
   * 明文下发是刻意的：整站必须登录才能进来，而"复制文档"的用途就是把这份说明
   * 连同密钥一起塞给云端 agent，省掉手工回填。它只经由 Server Component 以 prop
   * 形式进到已鉴权的会话里，不进任何公开接口，也不被缓存
   * （`/api-docs` 在 next.config.mjs 里单独加了 Cache-Control: no-store）。
   */
  apiSecret: string | null;
}

/** 页面上展示的示例用 shell 变量，真实密钥只在"复制"时展开。 */
const SECRET_VAR = "$API_SECRET";

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-base/70">
      <div className="border-b border-border-subtle bg-bg-elevated/50 px-3 py-2">
        <span className="text-[11px] uppercase tracking-wider text-text-muted">
          {label}
        </span>
      </div>
      <pre className="scrollbar-thin overflow-x-auto p-4 font-mono text-xs leading-relaxed text-text-secondary">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function CopyButton({
  text,
  children,
  className = "",
}: {
  text: string;
  children: ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`btn rounded-lg border border-border-subtle px-3 text-xs transition ${
        copied
          ? "text-fav"
          : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
      } ${className}`}
    >
      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
      {copied ? "已复制" : children}
    </button>
  );
}

export function ApiDocsClient({ baseUrl, apiSecret }: ApiDocsClientProps) {
  const apiBase = `${baseUrl}/api/prompts`;
  const exportUrl = `${baseUrl}/api/export`;
  const writeEnabled = apiSecret !== null;
  const [revealed, setRevealed] = useState(false);

  /** 复制出去的那份文本里用的是真密钥；没配置时退回占位符。 */
  const secretForText = apiSecret ?? "YOUR_API_SECRET";
  const maskedSecret = "•".repeat(18);

  const categoryList = CATEGORIES.map(
    (c) => `- ${c.value}（${CATEGORY_LABELS[c.value]}）`
  ).join("\n");

  const listExample = `curl -G "${apiBase}" \\
  --data-urlencode "category=image_generation" \\
  --data-urlencode "category=video_generation" \\
  --data-urlencode "tag=poster" \\
  --data-urlencode "tag=neon" \\
  --data-urlencode "q=midjourney" \\
  --data-urlencode "limit=10"`;

  const buildCreateExample = (bearer: string) => `curl -X POST "${apiBase}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${bearer}" \\
  -d '{
    "title": "示例提示词",
    "content": "请根据以下内容生成一张未来城市夜景图...",
    "notes": "适合 16:9 海报构图，可搭配冷色霓虹光。",
    "category": "image_generation",
    "tags": ["future", "city", "night"]
  }'`;

  const buildExportExample = (bearer: string) => `curl -H "Authorization: Bearer ${bearer}" \\
  "${exportUrl}?format=json" -o prompt-vault.json`;

  // 页面上永远是 $API_SECRET，避免密钥长时间停在屏幕 / 录屏 / 截屏里。
  const createExample = buildCreateExample(SECRET_VAR);
  const exportExample = buildExportExample(SECRET_VAR);

  /**
   * "复制文档"产出的就是喂给 agent 的指令包 —— 密钥内联，agent 拿到即可调用，
   * 不需要再回人工要一次凭据。
   */
  const docsText = `# Prompt Vault · 提示词库

基础地址：${baseUrl}

## 凭据
Authorization: Bearer ${secretForText}
GET 不需要凭据；POST 与整库导出必须带上上面这行完整请求头。

## 1. 读取提示词  GET ${apiBase}
返回最多 ${MAX_FAVORITES_RETURNED} 条收藏提示词，以及最多 limit 条非收藏提示词。
参数：
- category：可选，可重复传入；默认 image_generation
- q：可选，子串匹配标题 / 内容 / 备注，精确匹配标签
- tag：可选，可重复传入，最多 8 个；多值之间是 AND（必须同时含全部标签）
- limit：可选，非收藏条数上限，默认 10，最大 100
返回字段：title、content、notes、tags、is_favorite；仅当传入多个 category 时额外带 category。
示例：
${listExample}

## 2. 写入提示词  POST ${apiBase}
请求头：
  Content-Type: application/json
  Authorization: Bearer ${secretForText}
请求体：
- title：必填，最长 200 字符
- content：必填，最长 20000 字符
- category：必填，取值见文末
- notes：可选，最长 5000 字符
- tags：可选，最多 24 个，每个最长 50 字符
示例：
${buildCreateExample(secretForText)}

## 3. 整库导出  GET ${exportUrl}
需要同一个 Bearer。参数 format=json|md（默认 json）、notes=1|0（默认含备注）。
示例：
${buildExportExample(secretForText)}

## 分类取值
${categoryList}
`;

  return (
    <div className="relative z-10 flex h-[100dvh] flex-col overflow-hidden bg-bg-base">
      <header className="glass flex shrink-0 items-center justify-between border-b border-border-subtle/60 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="btn rounded-lg border border-border-subtle px-3 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            <ArrowLeftIcon size={16} />
            返回
          </Link>
          <div>
            <h1 className="font-display text-xl font-medium tracking-wide text-white">
              Prompt Vault API
            </h1>
            <p className="text-xs text-text-muted">外部调用与 AI 读取提示词</p>
          </div>
        </div>
        <CopyButton text={docsText}>
          {writeEnabled ? "复制文档（含密钥）" : "复制文档"}
        </CopyButton>
      </header>

      <main className="scrollbar-thin flex-1 overflow-y-auto px-6 py-8 md:px-10">
        <div className="mx-auto max-w-3xl space-y-10">
          {/* 鉴权策略 */}
          <section>
            <h2 className="mb-3 font-display text-lg text-white">鉴权策略</h2>
            <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-surface/50 p-4 text-sm leading-relaxed text-text-secondary">
              <p>
                <span className="font-medium text-text-primary">读取公开。</span>
                GET 不需要任何密钥 —— 这是刻意的，目的是让任意云端的 agent
                在任何地方都能直接取用。代价是内容公开可读，属于已知取舍。
              </p>
              <p>
                <span className="font-medium text-text-primary">写入加锁。</span>
                POST 一律要求 Bearer 密钥；服务端未配置{" "}
                <code className="rounded bg-bg-elevated px-1 py-0.5 text-text-primary">
                  API_SECRET
                </code>{" "}
                时，写接口直接返回 503，不会退化成无鉴权可写。密钥明文只在这张页面里出现，
                而这张页面本身需要登录。
              </p>
              <p>
                <span className="font-medium text-text-primary">不被收录。</span>
                所有响应都带{" "}
                <code className="rounded bg-bg-elevated px-1 py-0.5 text-text-primary">
                  X-Robots-Tag: noindex
                </code>
                ，配合全站{" "}
                <code className="rounded bg-bg-elevated px-1 py-0.5 text-text-primary">
                  robots.txt
                </code>{" "}
                拒绝 Disallow，以及页面级 meta 声明，避免出现在搜索结果里。
              </p>
            </div>

            {apiSecret && (
              <div className="mt-3 rounded-lg border border-border-subtle bg-bg-surface/50 p-4">
                <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-muted">
                  <LockIcon size={13} />
                  当前部署的密钥
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="scrollbar-thin min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-bg-elevated px-3 py-2 font-mono text-xs text-text-primary">
                    <span className="text-text-muted">export API_SECRET=</span>
                    &quot;{revealed ? apiSecret : maskedSecret}&quot;
                  </code>
                  <button
                    type="button"
                    onClick={() => setRevealed((v) => !v)}
                    className="btn rounded-lg border border-border-subtle px-3 text-xs text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
                    aria-pressed={revealed}
                  >
                    {revealed ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
                    {revealed ? "隐藏" : "显示"}
                  </button>
                  <CopyButton text={`export API_SECRET="${apiSecret}"`}>
                    复制
                  </CopyButton>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-text-muted">
                  下面示例里的{" "}
                  <code className="rounded bg-bg-elevated px-1 py-0.5">
                    $API_SECRET
                  </code>{" "}
                  指的就是它；点右上角复制文档时，密钥会被直接写进文本。
                </p>
              </div>
            )}

            {!writeEnabled && (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-300">
                <span className="mt-px shrink-0">
                  <AlertIcon size={14} />
                </span>
                当前服务端未配置 API_SECRET，写接口处于禁用状态（POST 会返回 503）。
              </p>
            )}

            {apiSecret && (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-300">
                <span className="mt-px shrink-0">
                  <AlertIcon size={14} />
                </span>
                <span>
                  复制出去的文档含密钥明文。等于把写入和整库导出的权限一起交出去 ——
                  只发给可信的 agent 或自己的机器。要轮换就改 Vercel 上的{" "}
                  <code className="rounded bg-bg-elevated px-1 py-0.5">
                    API_SECRET
                  </code>{" "}
                  再重新部署，旧密钥立刻失效。
                </span>
              </p>
            )}
          </section>

          {/* Base URL */}
          <section>
            <h2 className="mb-3 font-display text-lg text-white">基础地址</h2>
            <p className="mb-3 text-sm text-text-secondary">
              文档会根据当前部署的域名自动显示 URL。在 Vercel 上部署后，下方即为生产环境地址。
            </p>
            <CodeBlock code={baseUrl} label="BASE URL" />
          </section>

          {/* GET */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <span className="rounded-md bg-green-500/15 px-2 py-1 text-xs font-semibold text-green-400">
                GET
              </span>
              <h2 className="font-display text-lg text-white">
                获取提示词列表（公开，无需密钥）
              </h2>
            </div>
            <p className="mb-3 text-sm text-text-secondary">
              返回最多 {MAX_FAVORITES_RETURNED} 条收藏的提示词，以及最多{" "}
              <code className="rounded bg-bg-elevated px-1 py-0.5 text-text-primary">
                limit
              </code>{" "}
              条非收藏提示词。默认返回{" "}
              <code className="rounded bg-bg-elevated px-1 py-0.5 text-text-primary">
                image_generation
              </code>{" "}
              分类；不传 category 时等效于 category=image_generation。如需多个分类，可重复传入
              category 参数。返回字段仅包含 title、content、notes、tags、
              is_favorite；仅当传入多个 category 时额外返回 category。
            </p>
            <p className="mb-4 text-sm text-text-secondary">
              分页与搜索都在数据库侧完成，不会因为数据量增长而漏结果。
            </p>

            <div className="mb-4 overflow-hidden rounded-lg border border-border-subtle">
              <table className="w-full text-left text-sm">
                <thead className="bg-bg-elevated/50 text-xs uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="px-4 py-2">参数</th>
                    <th className="px-4 py-2">类型</th>
                    <th className="px-4 py-2">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-text-secondary">
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">category</td>
                    <td className="px-4 py-2 text-xs">string</td>
                    <td className="px-4 py-2">
                      可选，默认 image_generation；可重复传入多个值
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">q</td>
                    <td className="px-4 py-2 text-xs">string</td>
                    <td className="px-4 py-2">
                      可选，子串匹配标题/内容/备注，精确匹配标签（不区分大小写）
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">tag</td>
                    <td className="px-4 py-2 text-xs">string</td>
                    <td className="px-4 py-2">
                      可选，可重复传入多个值。多选之间是 AND ——
                      返回的记录必须同时含全部指定标签。最多 8 个；未知标签只命中 0 条，不报错。
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">limit</td>
                    <td className="px-4 py-2 text-xs">number</td>
                    <td className="px-4 py-2">
                      可选，非收藏提示词数量上限，默认 10，最大 100
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <CodeBlock code={listExample} label="cURL 示例" />
          </section>

          {/* POST */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <span className="rounded-md bg-accent/15 px-2 py-1 text-xs font-semibold text-accent">
                POST
              </span>
              <h2 className="font-display text-lg text-white">
                添加提示词（需要密钥）
              </h2>
            </div>
            <p className="mb-3 text-sm text-text-secondary">
              需要在请求头中携带{" "}
              <code className="rounded bg-bg-elevated px-1 py-0.5 text-text-primary">
                Authorization: Bearer {SECRET_VAR}
              </code>
              。密钥即部署时配置的{" "}
              <code className="rounded bg-bg-elevated px-1 py-0.5 text-text-primary">
                API_SECRET
              </code>
              ，先在上面那张卡片里复制出来，或直接复制整份文档。
            </p>

            <div className="mb-4 overflow-hidden rounded-lg border border-border-subtle">
              <table className="w-full text-left text-sm">
                <thead className="bg-bg-elevated/50 text-xs uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="px-4 py-2">字段</th>
                    <th className="px-4 py-2">类型</th>
                    <th className="px-4 py-2">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-text-secondary">
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">title</td>
                    <td className="px-4 py-2 text-xs">string</td>
                    <td className="px-4 py-2">必填，标题，最长 200 字符</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">content</td>
                    <td className="px-4 py-2 text-xs">string</td>
                    <td className="px-4 py-2">必填，提示词内容，最长 20000 字符</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">notes</td>
                    <td className="px-4 py-2 text-xs">string</td>
                    <td className="px-4 py-2">可选，备注，最长 5000 字符</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">category</td>
                    <td className="px-4 py-2 text-xs">string</td>
                    <td className="px-4 py-2">必填，见下方分类表</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">tags</td>
                    <td className="px-4 py-2 text-xs">string[]</td>
                    <td className="px-4 py-2">可选，最多 24 个，每个最长 50 字符</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <CodeBlock code={createExample} label="cURL 示例" />
          </section>

          {/* Export */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <span className="rounded-md bg-green-500/15 px-2 py-1 text-xs font-semibold text-green-400">
                GET
              </span>
              <h2 className="font-display text-lg text-white">
                整库导出（需要密钥）
              </h2>
            </div>
            <p className="mb-3 text-sm text-text-secondary">
              备份用。与{" "}
              <code className="rounded bg-bg-elevated px-1 py-0.5 text-text-primary">
                GET /api/prompts
              </code>{" "}
              不同，它<span className="font-medium text-text-primary">不公开</span>{" "}
              —— 接受{" "}
              <code className="rounded bg-bg-elevated px-1 py-0.5 text-text-primary">
                API_SECRET
              </code>{" "}
              或{" "}
              <code className="rounded bg-bg-elevated px-1 py-0.5 text-text-primary">
                CRON_SECRET
              </code>
              ，两者都未配置时返回 503。它按每页 1000 行分页取全量，不会因为
              PostgREST 的单次返回上限而漏数据。
            </p>
            <p className="mb-3 text-sm text-text-secondary">
              参数：
              <code className="rounded bg-bg-elevated px-1 py-0.5 text-text-primary">
                format=json|md
              </code>
              （默认 json）、
              <code className="rounded bg-bg-elevated px-1 py-0.5 text-text-primary">
                notes=1|0
              </code>
              （默认含备注）。
            </p>
            <CodeBlock code={exportExample} label="cURL 示例" />
            <p className="mt-3 text-xs leading-relaxed text-text-muted">
              恢复方式：本期不提供导入端点 —— 对偶发操作来说那是没必要扩大的攻击面。
              逐条重新 <code className="rounded bg-bg-elevated px-1 py-0.5">POST /api/prompts</code> 即可。
            </p>
          </section>

          {/* Categories */}
          <section>
            <h2 className="mb-3 font-display text-lg text-white">分类取值</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CATEGORIES.map((cat) => {
                const color = CATEGORY_COLORS[cat.value];
                return (
                  <div
                    key={cat.value}
                    className="flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface/50 px-4 py-3"
                  >
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <code className="font-mono text-xs text-text-primary">
                      {cat.value}
                    </code>
                    <span className="ml-auto text-xs text-text-secondary">
                      {CATEGORY_LABELS[cat.value]}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
