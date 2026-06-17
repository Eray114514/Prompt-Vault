"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
} from "@/lib/types";
import { CopyIcon, CheckIcon, ArrowLeftIcon } from "./Icons";

interface ApiDocsClientProps {
  baseUrl: string;
  hasApiSecret: boolean;
}

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

function CopyDocButton({ text }: { text: string }) {
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
      onClick={handleCopy}
      className={`btn rounded-lg border border-border-subtle px-3 text-xs transition ${
        copied
          ? "text-fav"
          : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
      }`}
    >
      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
      {copied ? "已复制" : "复制文档"}
    </button>
  );
}

export function ApiDocsClient({ baseUrl, hasApiSecret }: ApiDocsClientProps) {
  const apiBase = `${baseUrl}/api/prompts`;

  const categoryList = CATEGORIES.map(
    (c) => `- ${c.value}（${CATEGORY_LABELS[c.value]}）`
  ).join("\n");

  const listExample = `curl -G "${apiBase}" \\
  --data-urlencode "category=llm_chat" \\
  --data-urlencode "q=midjourney" \\
  --data-urlencode "limit=10"`;

  const createExample = `curl -X POST "${apiBase}" \\
  -H "Content-Type: application/json" ${
    hasApiSecret ? '\\\n  -H "Authorization: Bearer YOUR_API_SECRET" ' : ""
  }\\\n  -d '{
    "title": "示例提示词",
    "content": "请根据以下内容生成一张未来城市夜景图...",
    "category": "image_generation",
    "tags": ["future", "city", "night"]
  }'`;

  const docsText = `Prompt Vault API
基础地址：${baseUrl}

GET ${apiBase}
返回所有收藏提示词，以及最多 limit 条非收藏提示词。
参数：
- category：可选，按分类筛选
- q：可选，搜索标题、内容、标签（不区分大小写）
- limit：可选，默认 20，最大 100

示例：
${listExample}

POST ${apiBase}
新增一条提示词。${
    hasApiSecret
      ? "\n需要请求头：Authorization: Bearer YOUR_API_SECRET"
      : ""
  }
请求体：
- title：必填
- content：必填
- category：必填
- tags：可选

示例：
${createExample}

分类取值：
${categoryList}
`;

  return (
    <div className="relative z-10 flex h-screen flex-col overflow-hidden bg-bg-base">
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
        <CopyDocButton text={docsText} />
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
        <div className="mx-auto max-w-3xl space-y-10">
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
              <h2 className="font-display text-lg text-white">获取提示词列表</h2>
            </div>
            <p className="mb-3 text-sm text-text-secondary">
              返回所有收藏的提示词，以及最多{" "}
              <code className="rounded bg-bg-elevated px-1 py-0.5 text-text-primary">
                limit
              </code>{" "}
              条非收藏提示词。可分类、可搜索。
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
                    <td className="px-4 py-2">可选，按分类筛选</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">q</td>
                    <td className="px-4 py-2 text-xs">string</td>
                    <td className="px-4 py-2">可选，搜索标题、内容、标签（不区分大小写）</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">limit</td>
                    <td className="px-4 py-2 text-xs">number</td>
                    <td className="px-4 py-2">可选，非收藏提示词数量上限，默认 20，最大 100</td>
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
              <h2 className="font-display text-lg text-white">添加提示词</h2>
            </div>
            {hasApiSecret && (
              <p className="mb-3 text-sm text-text-secondary">
                需要在请求头中携带{" "}
                <code className="rounded bg-bg-elevated px-1 py-0.5 text-text-primary">
                  Authorization: Bearer YOUR_API_SECRET
                </code>
                。
              </p>
            )}

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
                    <td className="px-4 py-2">必填，标题</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">content</td>
                    <td className="px-4 py-2 text-xs">string</td>
                    <td className="px-4 py-2">必填，提示词内容</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">category</td>
                    <td className="px-4 py-2 text-xs">string</td>
                    <td className="px-4 py-2">必填，见下方分类表</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">tags</td>
                    <td className="px-4 py-2 text-xs">string[]</td>
                    <td className="px-4 py-2">可选，标签数组</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <CodeBlock code={createExample} label="cURL 示例" />
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
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: color,
                        boxShadow: `0 0 8px ${color}`,
                      }}
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
