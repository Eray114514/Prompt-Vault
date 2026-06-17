"use client";

import { useState, useEffect, useRef } from "react";
import type { Prompt, NewPrompt, Category } from "@/lib/types";
import { CATEGORIES, CATEGORY_COLORS } from "@/lib/types";
import { CloseIcon } from "./Icons";

interface PromptModalProps {
  prompt: Prompt | null;
  defaultCategory?: Category;
  prefillContent?: string;
  onSubmit: (data: NewPrompt) => Promise<void>;
  onClose: () => void;
}

export function PromptModal({
  prompt,
  defaultCategory,
  prefillContent,
  onSubmit,
  onClose,
}: PromptModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Category>("llm_chat");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prompt) {
      setTitle(prompt.title);
      setContent(prompt.content);
      setCategory(prompt.category);
      setTags(prompt.tags);
    } else if (prefillContent) {
      setTitle("");
      setContent(prefillContent);
      setCategory(defaultCategory ?? "llm_chat");
      setTags([]);
    } else {
      setTitle("");
      setContent("");
      setCategory(defaultCategory ?? "llm_chat");
      setTags([]);
    }
    setTagInput("");
  }, [prompt, prefillContent, defaultCategory]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const addTag = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    if (tags.includes(value)) {
      setTagInput("");
      return;
    }
    setTags((prev) => [...prev, value]);
    setTagInput("");
  };

  const removeTag = (idx: number) => {
    setTags((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const handleTagBlur = () => {
    addTag(tagInput);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const parts = pasted
      .split(/[,，\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const newTags = parts.filter((p) => !tags.includes(p));
    if (newTags.length > 0) {
      setTags((prev) => [...prev, ...newTags]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        category,
        tags,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-strong flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部霓虹条 */}
        <div
          className="h-1 w-full shrink-0"
          style={{
            background: `linear-gradient(90deg, ${CATEGORY_COLORS.image_generation}, ${CATEGORY_COLORS.image_editing}, ${CATEGORY_COLORS.video_generation}, ${CATEGORY_COLORS.llm_chat})`,
            boxShadow: "0 0 20px rgba(255,107,53,0.4)",
          }}
        />

        <div className="flex shrink-0 items-center justify-between border-b border-border-subtle/60 px-5 py-4">
          <h2 className="font-display text-lg font-medium tracking-wide text-white">
            {prompt ? "编辑档案" : "新建档案"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted transition hover:bg-bg-hover hover:text-text-primary"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 overflow-y-auto p-5"
        >
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-text-muted">
              标题
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="给这个提示词起个名字"
              autoFocus
              className="h-10 w-full rounded-lg border border-border-subtle bg-bg-input px-3.5 text-sm text-text-primary placeholder-text-muted transition focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-wider text-text-muted">
              分类
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CATEGORIES.map((cat) => {
                const color = CATEGORY_COLORS[cat.value];
                const active = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`rounded-lg border px-3 py-2 text-center text-xs font-medium transition-all duration-200 ${
                      active
                        ? "text-black"
                        : "bg-bg-elevated text-text-secondary hover:text-text-primary"
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor: color,
                            borderColor: color,
                            boxShadow: `0 0 14px ${color}55`,
                          }
                        : { borderColor: `${color}30` }
                    }
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col">
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-text-muted">
              内容
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="粘贴或输入提示词内容..."
              rows={8}
              className="max-h-52 w-full resize-y rounded-lg border border-border-subtle bg-bg-input px-3.5 py-3 font-mono text-sm leading-relaxed text-text-primary placeholder-text-muted transition focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-text-muted">
              标签
            </label>
            <div
              className="flex min-h-[42px] flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-bg-input px-2.5 py-1.5 transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]"
              onClick={() => tagInputRef.current?.focus()}
            >
              {tags.map((tag, idx) => (
                <span
                  key={`${tag}-${idx}`}
                  className="flex items-center gap-1 rounded-md bg-bg-elevated px-2 py-1 text-xs text-text-primary"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(idx)}
                    className="rounded text-text-muted hover:text-white"
                    aria-label="删除标签"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={handleTagBlur}
                onPaste={handlePaste}
                placeholder={tags.length === 0 ? "输入后回车添加" : ""}
                className="min-w-[80px] flex-1 bg-transparent py-1 text-sm text-text-primary placeholder-text-muted outline-none"
              />
            </div>
            <p className="mt-1.5 text-[10px] text-text-muted">
              按 Enter 添加，支持粘贴逗号/换行分隔的多标签
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn h-10 rounded-lg border border-border-subtle px-5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !content.trim()}
              className="btn h-10 rounded-lg bg-accent px-6 text-white shadow-[0_0_16px_rgba(255,107,53,0.25)] transition hover:bg-accent-hover hover:shadow-[0_0_24px_rgba(255,107,53,0.4)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "保存中..." : prompt ? "保存" : "添加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
