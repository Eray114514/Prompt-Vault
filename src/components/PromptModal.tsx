"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { Prompt, NewPrompt, Category } from "@/lib/types";
import { CATEGORIES, CATEGORY_COLORS, PROMPT_LIMITS } from "@/lib/types";
import { CloseIcon } from "./Icons";
import { useFocusTrap } from "./useFocusTrap";

const DEFAULT_CATEGORY: Category = "image_generation";
const MAX_SUGGESTIONS = 8;

interface PromptModalProps {
  prompt: Prompt | null;
  defaultCategory?: Category;
  prefillContent?: string;
  /** 全量标签（父级聚合后传入）。弹窗只拿得到单条 prompt，自己算不出候选。 */
  tagSuggestions?: string[];
  onSubmit: (data: NewPrompt) => Promise<void>;
  onClose: () => void;
}

export function PromptModal({
  prompt,
  defaultCategory,
  prefillContent,
  tagSuggestions = [],
  onSubmit,
  onClose,
}: PromptModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<Category>(DEFAULT_CATEGORY);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const tagInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // 用一个 ref 镜像下拉开关状态：全局 Escape 监听是原生监听，
  // 读 state 会读到本次事件之前的旧值。
  const suggestOpenRef = useRef(false);

  useFocusTrap(dialogRef, true);

  useEffect(() => {
    if (prompt) {
      setTitle(prompt.title);
      setContent(prompt.content);
      setNotes(prompt.notes ?? "");
      setCategory(prompt.category);
      setTags(prompt.tags);
    } else if (prefillContent) {
      setTitle("");
      setContent(prefillContent);
      setNotes("");
      setCategory(defaultCategory ?? DEFAULT_CATEGORY);
      setTags([]);
    } else {
      setTitle("");
      setContent("");
      setNotes("");
      setCategory(defaultCategory ?? DEFAULT_CATEGORY);
      setTags([]);
    }
    setTagInput("");
    setSuggestOpen(false);
    setHighlight(-1);
  }, [prompt, prefillContent, defaultCategory]);

  useEffect(() => {
    suggestOpenRef.current = suggestOpen;
  }, [suggestOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // 补全下拉打开时，Esc 只该关下拉，不能顺手把整个弹窗也关掉
      if (suggestOpenRef.current) return;
      onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const suggestions = useMemo(() => {
    const query = tagInput.trim().toLowerCase();
    if (!query) return [];
    const pool = tagSuggestions.filter((tag) => !tags.includes(tag));
    const startsWith = pool.filter((tag) => tag.toLowerCase().startsWith(query));
    const contains = pool.filter(
      (tag) =>
        !tag.toLowerCase().startsWith(query) && tag.toLowerCase().includes(query)
    );
    // 前缀命中优先于子串命中
    return [...startsWith, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [tagInput, tagSuggestions, tags]);

  const addTag = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    if (tags.includes(value) || tags.length >= PROMPT_LIMITS.tagCount) {
      setTagInput("");
      return;
    }
    setTags((prev) => [...prev, value.slice(0, PROMPT_LIMITS.tagLength)]);
    setTagInput("");
  };

  const removeTag = (idx: number) => {
    setTags((prev) => prev.filter((_, i) => i !== idx));
  };

  const closeSuggestions = () => {
    setSuggestOpen(false);
    setHighlight(-1);
  };

  const acceptSuggestion = (suggestion: string) => {
    addTag(suggestion);
    closeSuggestions();
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const listOpen = suggestOpen && suggestions.length > 0;

    if (listOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
        return;
      }
      if (e.key === "Escape") {
        // 只关下拉。stopPropagation 是双保险：即使全局监听先跑了，
        // suggestOpenRef 也还停在 true，弹窗不会被误关。
        e.preventDefault();
        e.stopPropagation();
        closeSuggestions();
        return;
      }
      if (e.key === "Enter" && highlight >= 0) {
        e.preventDefault();
        acceptSuggestion(suggestions[highlight]);
        return;
      }
    }

    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
      closeSuggestions();
    } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const handleTagBlur = () => {
    addTag(tagInput);
    closeSuggestions();
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
      setTags((prev) =>
        [...prev, ...newTags]
          .slice(0, PROMPT_LIMITS.tagCount)
          .map((tag) => tag.slice(0, PROMPT_LIMITS.tagLength))
      );
    }
    closeSuggestions();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        notes: notes.trim(),
        category,
        tags,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-modal-title"
        className="glass-strong animate-scale-in flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶条现在承载"正在编辑哪个分类"这一信息，不再是装饰性的四色渐变 */}
        <div
          className="h-1 w-full shrink-0 transition-colors duration-200"
          style={{ backgroundColor: CATEGORY_COLORS[category] }}
        />

        <div className="flex shrink-0 items-center justify-between border-b border-border-subtle/60 px-5 py-4">
          <h2
            id="prompt-modal-title"
            className="font-display text-lg font-medium tracking-wide text-white"
          >
            {prompt ? "编辑档案" : "新建档案"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-md p-1.5 text-text-muted transition hover:bg-bg-hover hover:text-text-primary"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid overflow-y-auto lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.35fr)]"
        >
          <div className="space-y-4 border-b border-border-subtle/60 p-5 lg:border-b-0 lg:border-r lg:p-6">
            <div>
              <label
                htmlFor="prompt-title"
                className="mb-1.5 block text-[11px] tracking-wider text-text-muted"
              >
                标题
              </label>
              <input
                id="prompt-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="给这个提示词起个名字"
                maxLength={PROMPT_LIMITS.title}
                autoFocus
                className="h-10 w-full rounded-lg border border-border-subtle bg-bg-input px-3.5 text-sm text-text-primary placeholder-text-muted transition focus:border-accent"
              />
            </div>

            <fieldset>
              <legend className="mb-2 block text-[11px] tracking-wider text-text-muted">
                分类
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => {
                  const color = CATEGORY_COLORS[cat.value];
                  const active = category === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      aria-pressed={active}
                      className={`rounded-lg border px-3 py-2 text-center text-xs font-medium transition-all duration-200 ${
                        active
                          ? "text-black"
                          : "bg-bg-elevated text-text-secondary hover:text-text-primary"
                      }`}
                      style={
                        active
                          ? { backgroundColor: color, borderColor: color }
                          : { borderColor: `${color}30` }
                      }
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label
                htmlFor="prompt-tags"
                className="mb-1.5 block text-[11px] tracking-wider text-text-muted"
              >
                标签
              </label>
              <div className="relative">
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
                        aria-label={`删除标签 ${tag}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    id="prompt-tags"
                    ref={tagInputRef}
                    type="text"
                    value={tagInput}
                    onChange={(e) => {
                      setTagInput(e.target.value);
                      setSuggestOpen(true);
                      setHighlight(-1);
                    }}
                    onFocus={() => setSuggestOpen(true)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={handleTagBlur}
                    onPaste={handlePaste}
                    placeholder={tags.length === 0 ? "输入后回车添加" : ""}
                    maxLength={PROMPT_LIMITS.tagLength}
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={suggestOpen && suggestions.length > 0}
                    aria-controls="prompt-tags-listbox"
                    aria-activedescendant={
                      highlight >= 0 ? `prompt-tag-option-${highlight}` : undefined
                    }
                    aria-describedby="prompt-tags-hint"
                    className="min-w-[80px] flex-1 bg-transparent py-1 text-sm text-text-primary placeholder-text-muted outline-none"
                  />
                </div>

                {suggestOpen && suggestions.length > 0 && (
                  <ul
                    id="prompt-tags-listbox"
                    role="listbox"
                    aria-label="标签建议"
                    className="scrollbar-thin absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border-subtle bg-bg-elevated py-1 shadow-lg"
                  >
                    {suggestions.map((suggestion, index) => (
                      <li
                        key={suggestion}
                        id={`prompt-tag-option-${index}`}
                        role="option"
                        aria-selected={index === highlight}
                        // onMouseDown + preventDefault 防止输入框先失焦 ——
                        // 否则 blur 里的 addTag 会抢在点击之前把半截输入提交掉
                        onMouseDown={(e) => {
                          e.preventDefault();
                          acceptSuggestion(suggestion);
                        }}
                        onMouseEnter={() => setHighlight(index)}
                        className={`cursor-pointer truncate px-3 py-1.5 text-xs transition ${
                          index === highlight
                            ? "bg-bg-hover text-text-primary"
                            : "text-text-secondary"
                        }`}
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p id="prompt-tags-hint" className="mt-1.5 text-[11px] text-text-muted">
                按 Enter 添加，支持粘贴逗号/换行分隔的多标签（最多 {PROMPT_LIMITS.tagCount} 个）
              </p>
            </div>

            <div>
              <label
                htmlFor="prompt-notes"
                className="mb-1.5 block text-[11px] tracking-wider text-text-muted"
              >
                备注
              </label>
              <textarea
                id="prompt-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="补充用途、参数、图片说明或注意事项..."
                rows={6}
                maxLength={PROMPT_LIMITS.notes}
                className="min-h-[120px] w-full resize-y rounded-lg border border-border-subtle bg-bg-input px-3.5 py-3 text-sm leading-relaxed text-text-primary placeholder-text-muted transition focus:border-accent lg:min-h-[160px]"
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-4 p-5 lg:p-6">
            <div className="flex min-h-[320px] flex-1 flex-col">
              <label
                htmlFor="prompt-content"
                className="mb-1.5 block text-[11px] tracking-wider text-text-muted"
              >
                内容
              </label>
              <textarea
                id="prompt-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="粘贴或输入提示词内容..."
                rows={14}
                maxLength={PROMPT_LIMITS.content}
                className="min-h-[280px] w-full flex-1 resize-y rounded-lg border border-border-subtle bg-bg-input px-3.5 py-3 font-mono text-sm leading-relaxed text-text-primary placeholder-text-muted transition focus:border-accent"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-border-subtle/60 pt-4">
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
                className="btn glow-accent h-10 rounded-lg bg-accent px-6 text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "保存中..." : prompt ? "保存" : "添加"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
