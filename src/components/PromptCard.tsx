"use client";

import { useState } from "react";
import type { Prompt } from "@/lib/types";
import { CATEGORY_LABELS, categoryColor } from "@/lib/types";
import { CopyIcon, CheckIcon, PencilIcon, TrashIcon, StarIcon } from "./Icons";

interface PromptCardProps {
  prompt: Prompt;
  onCopy: (content: string) => void;
  onEdit: (p: Prompt) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  index?: number;
}

export function PromptCard({
  prompt,
  onCopy,
  onEdit,
  onDelete,
  onToggleFavorite,
  index = 0,
}: PromptCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = () => {
    onCopy(prompt.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const PREVIEW_LEN = 180;
  const isLong = prompt.content.length > PREVIEW_LEN;
  const contentPreview = expanded
    ? prompt.content
    : prompt.content.slice(0, PREVIEW_LEN);

  const catColor = categoryColor(prompt.category);
  const notes = prompt.notes?.trim();

  return (
    <div
      className="card-enter group relative flex flex-col rounded-xl border border-border-subtle/80 bg-bg-surface/70 p-5 shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-border-hover hover:bg-bg-elevated/70 hover:shadow-lg"
      style={{
        animationDelay: `${index * 50}ms`,
        boxShadow: "0 2px 0 0 rgba(255,255,255,0.02) inset",
      }}
    >
      {/* 顶部霓虹条 */}
      <div
        className="absolute left-5 right-5 top-0 h-0.5 rounded-b-full opacity-60 transition-opacity group-hover:opacity-100"
        style={{
          backgroundColor: catColor,
          boxShadow: `0 0 12px ${catColor}, 0 0 4px ${catColor}`,
        }}
      />

      {/* 标题栏 */}
      <div className="mb-3 flex items-start justify-between gap-3 pt-1">
        <h3 className="line-clamp-1 font-display text-lg font-medium tracking-wide text-text-primary">
          {prompt.title}
        </h3>
        <button
          onClick={() => onToggleFavorite(prompt.id, prompt.is_favorite)}
          className={`shrink-0 rounded-md p-1 transition ${
            prompt.is_favorite
              ? "text-fav"
              : "text-text-muted hover:text-text-secondary"
          }`}
          title={prompt.is_favorite ? "取消收藏" : "收藏"}
        >
          <StarIcon
            size={17}
            filled={prompt.is_favorite}
            className={prompt.is_favorite ? "drop-shadow-[0_0_6px_rgba(255,214,0,0.6)]" : ""}
          />
        </button>
      </div>

      {/* 分类 & 标签 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          className="rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
          style={{
            borderColor: `${catColor}40`,
            color: catColor,
            backgroundColor: `${catColor}10`,
          }}
        >
          {CATEGORY_LABELS[prompt.category]}
        </span>
        {prompt.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-bg-hover px-2 py-0.5 text-[10px] text-text-muted"
          >
            {tag}
          </span>
        ))}
        {prompt.tags.length > 4 && (
          <span className="text-[10px] text-text-muted">
            +{prompt.tags.length - 4}
          </span>
        )}
      </div>

      {notes && (
        <div className="mb-4 rounded-md border border-border-subtle/50 bg-bg-hover/50 px-3 py-2 text-xs leading-relaxed text-text-secondary">
          <span className="mr-2 text-[10px] uppercase tracking-wider text-text-muted">
            备注
          </span>
          {notes}
        </div>
      )}

      {/* 内容 */}
      <div
        className="mb-4 flex-1 cursor-text whitespace-pre-wrap break-words rounded-md border border-border-subtle/40 bg-bg-base/50 p-3 font-mono text-xs leading-relaxed text-text-secondary"
        onClick={() => isLong && setExpanded(!expanded)}
      >
        {contentPreview}
        {isLong && !expanded && (
          <span className="text-text-muted"> ...</span>
        )}
        {isLong && expanded && (
          <span
            className="ml-1 cursor-pointer font-body text-[11px] uppercase tracking-wider"
            style={{ color: catColor }}
          >
            收起
          </span>
        )}
      </div>

      {/* 底部操作 */}
      <div className="mt-auto flex items-center justify-between border-t border-border-subtle/60 pt-4">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">
          {new Date(prompt.created_at).toLocaleDateString("zh-CN", {
            year: "2-digit",
            month: "2-digit",
            day: "2-digit",
          })}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className={`btn rounded-md px-2.5 py-1.5 text-xs ${
              copied
                ? "bg-fav-soft text-fav"
                : "bg-bg-hover text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
            }`}
          >
            {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            {copied ? "已复制" : "复制"}
          </button>
          <button
            onClick={() => onEdit(prompt)}
            className="btn rounded-md p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary"
            title="编辑"
          >
            <PencilIcon size={14} />
          </button>
          <button
            onClick={() => {
              if (confirm("确认删除此提示词？")) onDelete(prompt.id);
            }}
            className="btn rounded-md p-1.5 text-text-muted hover:bg-red-500/10 hover:text-red-400"
            title="删除"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
