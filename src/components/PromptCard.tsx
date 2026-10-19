"use client";

import { useState, useEffect, useRef } from "react";
import type { Prompt } from "@/lib/types";
import { CATEGORY_LABELS, categoryColor } from "@/lib/types";
import { CopyIcon, CheckIcon, PencilIcon, TrashIcon, StarIcon } from "./Icons";

interface PromptCardProps {
  prompt: Prompt;
  onCopy: (content: string) => void;
  onEdit: (p: Prompt) => void;
  /** 传整条记录而不是 id —— 删除现在是延迟提交的，撤销时需要把内容放回去 */
  onDelete: (p: Prompt) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  /** 点击卡片上的标签 chip 直接筛选 —— 否则标签只能靠手打搜索词命中 */
  onTagClick: (tag: string) => void;
  /** 模型 chip 同样可点：模型是比标签更强的"适用面"约束 */
  onModelClick: (model: string) => void;
  activeTags: string[];
  /** 当前生效的模型筛选（空串 = 未筛选） */
  activeModel: string;
  /** 批量选择模式：整张卡片变成选择开关，卡片内的操作按钮暂时让位 */
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  index?: number;
}

export function PromptCard({
  prompt,
  onCopy,
  onEdit,
  onDelete,
  onToggleFavorite,
  onTagClick,
  onModelClick,
  activeTags,
  activeModel,
  selectionMode,
  selected,
  onToggleSelect,
  index = 0,
}: PromptCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  /** 每次复制自增，用作闪光层的 key —— 新 key 必然重挂载，动画就一定会从头播。 */
  const [flashNonce, setFlashNonce] = useState(0);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  // 复制成功的反馈落在按钮自身（一圈脉冲），而不是屏幕底部的 toast ——
  // 眼睛本来就在卡片上，没必要跳一次视线。底部 toast 留给创建/更新/删除这类结果。
  const handleCopy = () => {
    onCopy(prompt.content);
    setCopied(true);
    setFlashNonce((n) => n + 1);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  const PREVIEW_LEN = 180;
  const isLong = prompt.content.length > PREVIEW_LEN;
  const contentPreview = expanded
    ? prompt.content
    : prompt.content.slice(0, PREVIEW_LEN);

  const catColor = categoryColor(prompt.category);
  const notes = prompt.notes?.trim();
  const NOTE_PREVIEW_LEN = 140;
  const NOTE_PREVIEW_LINES = 4;
  const noteLines = notes?.split(/\r?\n/) ?? [];
  const noteLinePreview = noteLines.slice(0, NOTE_PREVIEW_LINES).join("\n");
  const notePreview =
    noteLinePreview.length > NOTE_PREVIEW_LEN
      ? noteLinePreview.slice(0, NOTE_PREVIEW_LEN).trimEnd()
      : noteLinePreview;
  const isNotesLong =
    Boolean(notes) &&
    (noteLines.length > NOTE_PREVIEW_LINES || notes!.length > notePreview.length);
  const notesToShow = notesExpanded ? notes : notePreview;

  const createdAt = new Date(prompt.created_at);

  return (
    <div
      className="card-enter group relative flex flex-col rounded-xl border border-border-subtle/80 bg-bg-surface/70 p-5 shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-border-hover hover:bg-bg-elevated/70 hover:shadow-lg"
      style={{
        animationDelay: `${index * 50}ms`,
        boxShadow: "0 2px 0 0 rgba(255,255,255,0.02) inset",
      }}
    >
      {/* 顶条：色彩承载分类信息，不再叠发光 */}
      <div
        aria-hidden="true"
        className="absolute left-5 right-5 top-0 h-0.5 rounded-b-full opacity-80 transition-opacity group-hover:opacity-100"
        style={{ backgroundColor: catColor }}
      />

      {/* 标题栏 */}
      <div className="mb-3 flex items-start justify-between gap-3 pt-1">
        <h3 className="line-clamp-1 font-display text-lg font-medium tracking-wide text-text-primary">
          {prompt.title}
        </h3>
        <button
          type="button"
          onClick={() => onToggleFavorite(prompt.id, prompt.is_favorite)}
          className={`shrink-0 rounded-md p-1 transition ${
            prompt.is_favorite
              ? "text-fav"
              : "text-text-muted hover:text-text-secondary"
          }`}
          aria-label={prompt.is_favorite ? "取消收藏" : "收藏"}
          aria-pressed={prompt.is_favorite}
        >
          <StarIcon
            size={17}
            filled={prompt.is_favorite}
            className={prompt.is_favorite ? "drop-shadow-[0_0_5px_var(--fav-glow)]" : ""}
          />
        </button>
      </div>

      {/* 分类 & 模型 & 标签 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wider"
          style={{
            borderColor: `${catColor}40`,
            color: catColor,
            backgroundColor: `${catColor}10`,
          }}
        >
          {CATEGORY_LABELS[prompt.category]}
        </span>
        {/**
         * 模型铭牌：排在其他标签最前面，但不抢分类的霓虹色 ——
         * 模型名跨品牌，给它上任何一家品牌的颜色都会误导。改用中性银灰 + 菱形前缀，
         * 靠"形状"而不是"颜色"把它和自由标签区分开。
         */}
        {prompt.model?.trim() && (
          <button
            type="button"
            onClick={() => onModelClick(prompt.model)}
            aria-pressed={
              activeModel.toLowerCase() === prompt.model.trim().toLowerCase()
            }
            title={`按模型筛选：${prompt.model}`}
            className={`inline-flex max-w-[11rem] items-center gap-1 rounded-[5px] border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.04em] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition ${
              activeModel.toLowerCase() === prompt.model.trim().toLowerCase()
                ? "border-accent/55 bg-accent/15 text-text-primary"
                : "border-white/15 bg-white/[0.055] text-text-primary/90 hover:border-white/30 hover:bg-white/10"
            }`}
          >
            <span aria-hidden="true" className="text-[8px] text-accent/85">
              ◇
            </span>
            <span className="truncate">{prompt.model}</span>
          </button>
        )}
        {prompt.tags.slice(0, 4).map((tag) => {
          const active = activeTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onTagClick(tag)}
              aria-pressed={active}
              title={`按标签筛选：${tag}`}
              className={`max-w-[9rem] truncate rounded-md px-2 py-0.5 text-[11px] transition ${
                active
                  ? "bg-accent/20 text-text-primary"
                  : "bg-bg-hover text-text-muted hover:text-text-secondary"
              }`}
            >
              {tag}
            </button>
          );
        })}
        {prompt.tags.length > 4 && (
          <span className="text-[11px] text-text-muted">
            +{prompt.tags.length - 4}
          </span>
        )}
      </div>

      {notes && (
        <div className="mb-4 rounded-md border border-border-subtle/50 bg-bg-hover/50 px-3 py-2 text-xs leading-relaxed text-text-secondary">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="text-[11px] tracking-wider text-text-muted">备注</span>
            {isNotesLong && (
              <button
                type="button"
                onClick={() => setNotesExpanded((prev) => !prev)}
                aria-expanded={notesExpanded}
                className="shrink-0 text-[11px] tracking-wider transition hover:text-text-primary"
                style={{ color: catColor }}
              >
                {notesExpanded ? "收起" : "展开"}
              </button>
            )}
          </div>
          <div
            className={`whitespace-pre-wrap break-words ${
              notesExpanded
                ? "max-h-44 overflow-y-auto pr-1 scrollbar-thin"
                : "max-h-20 overflow-hidden"
            }`}
          >
            {notesToShow}
            {isNotesLong && !notesExpanded && (
              <span className="text-text-muted"> ...</span>
            )}
          </div>
        </div>
      )}

      {/* 内容 */}
      <div
        className={`mb-4 flex-1 whitespace-pre-wrap break-words rounded-md border border-border-subtle/40 bg-bg-base/50 p-3 font-mono text-xs leading-relaxed text-text-secondary ${
          isLong
            ? "cursor-pointer transition-colors hover:border-border-hover"
            : "cursor-text"
        } ${expanded && isLong ? "max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin" : ""}`}
        {...(isLong
          ? {
              role: "button",
              tabIndex: 0,
              "aria-expanded": expanded,
              "aria-label": expanded ? "收起提示词内容" : "展开完整提示词内容",
              onClick: () => setExpanded((prev) => !prev),
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setExpanded((prev) => !prev);
                }
              },
            }
          : {})}
      >
        {contentPreview}
        {isLong && !expanded && <span className="text-text-muted"> ...</span>}
        {isLong && expanded && (
          <span
            className="ml-1 font-body text-[11px] tracking-wider"
            style={{ color: catColor }}
          >
            收起
          </span>
        )}
      </div>

      {/* 底部操作 */}
      <div className="mt-auto flex items-center justify-between border-t border-border-subtle/60 pt-4">
        <time
          dateTime={prompt.created_at}
          className="text-[11px] tracking-wider text-text-muted"
        >
          {createdAt.toLocaleDateString("zh-CN", {
            year: "2-digit",
            month: "2-digit",
            day: "2-digit",
          })}
        </time>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            aria-label="复制提示词内容"
            className={`btn relative rounded-md px-2.5 py-1.5 text-xs ${
              copied
                ? "bg-fav-soft text-fav"
                : "bg-bg-hover text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
            }`}
          >
            {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            {copied ? "已复制" : "复制"}
            {flashNonce > 0 && (
              <span
                key={flashNonce}
                aria-hidden="true"
                className="flash-copy pointer-events-none absolute inset-0 rounded-md"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => onEdit(prompt)}
            aria-label={`编辑「${prompt.title}」`}
            className="btn rounded-md p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary"
          >
            <PencilIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(prompt)}
            aria-label={`删除「${prompt.title}」`}
            className="btn rounded-md p-1.5 text-text-muted hover:bg-red-500/10 hover:text-red-400"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      </div>

      {/**
       * 选择层盖住整张卡：批量场景下"点哪都能选"比"只有小方框能点"快得多。
       * 代价是这一层存在时卡内的复制/编辑按钮暂时不可点 —— 选择模式下这是合理的，
       * 想操作单条就退出批量。z-20 保证它盖住顶部色条与收藏星标。
       */}
      {selectionMode && (
        <button
          type="button"
          onClick={() => onToggleSelect(prompt.id)}
          aria-pressed={selected}
          aria-label={
            selected ? `取消选择「${prompt.title}」` : `选择「${prompt.title}」`
          }
          className={`absolute inset-0 z-20 rounded-xl border-2 transition-colors duration-150 ${
            selected
              ? "border-accent bg-accent/[0.07]"
              : "border-transparent hover:border-white/15 hover:bg-white/[0.035]"
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold transition ${
              selected
                ? "border-accent bg-accent text-white"
                : "border-white/30 bg-bg-base/80 text-transparent"
            }`}
          >
            ✓
          </span>
        </button>
      )}
    </div>
  );
}
