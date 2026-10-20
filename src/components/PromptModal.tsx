"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { Prompt, NewPrompt, Category } from "@/lib/types";
import { CATEGORIES, CATEGORY_COLORS, PROMPT_LIMITS } from "@/lib/types";
import { sanitizeModelDraft } from "@/lib/prompts";
import { CloseIcon } from "./Icons";
import { useFocusTrap } from "./useFocusTrap";

const DEFAULT_CATEGORY: Category = "image_generation";
const MAX_SUGGESTIONS = 8;
/** 快捷模型 chip 的数量：够覆盖常用模型，又不至于把表单撑长。 */
const MAX_MODEL_CHIPS = 6;

/** 草稿与表单字段一一对应，刻意不含 tagInput 这类"输到一半"的临时值。 */
interface FormDraft {
  title: string;
  content: string;
  notes: string;
  category: Category;
  model: string;
  tags: string[];
}

function draftStorageKey(id: string | undefined): string {
  return `pv_draft:${id ?? "new"}`;
}

function sameDraft(a: FormDraft, b: FormDraft): boolean {
  return (
    a.title === b.title &&
    a.content === b.content &&
    a.notes === b.notes &&
    a.category === b.category &&
    a.model === b.model &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, index) => tag === b.tags[index])
  );
}

/**
 * 读草稿。用 sessionStorage 而不是 localStorage：草稿属于"这个标签页里还没写完的东西"，
 * 关掉标签页就该消失；但整页刷新、组件重新挂载之后它得还在 —— 这正是要的效果。
 */
function readDraft(key: string): FormDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FormDraft> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (
      typeof parsed.title !== "string" ||
      typeof parsed.content !== "string" ||
      typeof parsed.notes !== "string" ||
      typeof parsed.model !== "string"
    ) {
      return null;
    }
    if (!CATEGORIES.some((cat) => cat.value === parsed.category)) return null;
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((tag): tag is string => typeof tag === "string")
      : [];
    return {
      title: parsed.title,
      content: parsed.content,
      notes: parsed.notes,
      category: parsed.category as Category,
      model: parsed.model,
      tags,
    };
  } catch {
    return null;
  }
}

function writeDraft(key: string, draft: FormDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // 配额满或隐私模式：草稿保护是尽力而为，写不进去也不该挡住编辑
  }
}

function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // 同上
  }
}

interface PromptModalProps {
  prompt: Prompt | null;
  defaultCategory?: Category;
  /**
   * 新建时默认带入的标签 —— 取当前侧栏选中的标签。
   * 这是标签版的"位置继承"：点进某个分类再新建，分类会自动填好；
   * 标签也必须如此，否则归类的成本全落在每次手打上。
   */
  initialTags?: string[];
  prefillContent?: string;
  /** 全量标签（父级聚合后传入，按使用次数降序）。弹窗只拿得到单条 prompt，自己算不出候选。 */
  tagSuggestions?: string[];
  /** 新建时默认带入的模型 —— 与标签同理，继承当前筛选位置。 */
  defaultModel?: string;
  /** 全量模型（父级聚合后传入，按使用次数降序）。 */
  modelSuggestions?: string[];
  /**
   * 返回 true 表示真的落库成功 —— 弹窗据此决定是否丢弃草稿。
   * 只靠"Promise resolve"不够：父级的 runAction 会吞掉失败，失败也是 resolve。
   */
  onSubmit: (data: NewPrompt) => Promise<boolean>;
  onClose: () => void;
}

export function PromptModal({
  prompt,
  defaultCategory,
  initialTags,
  prefillContent,
  tagSuggestions = [],
  defaultModel,
  modelSuggestions = [],
  onSubmit,
  onClose,
}: PromptModalProps) {
  const tagInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // 只在挂载时快照一次带入的标签。若直接把它写进下面 useEffect 的依赖，
  // 父组件任何一次重渲染都会重置草稿 —— 用户改到一半的标签会被抹掉。
  const inheritedTagsRef = useRef<string[]>(initialTags ?? []);
  // 用一个 ref 镜像下拉开关状态：全局 Escape 监听是原生监听，
  // 读 state 会读到本次事件之前的旧值。
  const suggestOpenRef = useRef(false);
  const modelOpenRef = useRef(false);
  // 按下鼠标时指针是不是落在遮罩本身（而不是弹窗内部再拖出来）。
  // 浏览器把 mousedown 与 mouseup 的共同祖先当作 click 目标，所以在正文里选中文字、
  // 鼠标拖到框外松手，click 会打在遮罩上 —— 光看 click 的 target 拦不住。
  const backdropPressRef = useRef(false);
  // 已成功保存：卸载前不要再用旧值把草稿写回去。
  const savedRef = useRef(false);

  const draftKey = draftStorageKey(prompt?.id);

  /**
   * 挂载时一次性算出初值（含草稿恢复）。之后父组件再怎么重渲染都不再碰表单。
   *
   * 旧实现把 props 写进 effect 依赖里重置表单，于是 `router.refresh()` 一类
   * "页面自己刷新一下"的动作只要让 prompt 换了对象身份，标题/正文/备注就会被
   * 服务端值覆盖回去 —— 用户看到的就是"我没动，编辑了一半的东西没了"。
   */
  const [initial] = useState(() => {
    const base: FormDraft = prompt
      ? {
          title: prompt.title,
          content: prompt.content,
          notes: prompt.notes ?? "",
          category: prompt.category,
          model: prompt.model ?? "",
          tags: prompt.tags,
        }
      : {
          // 新建：分类、模型与标签都继承当前筛选的位置
          title: "",
          content: prefillContent ?? "",
          notes: "",
          category: defaultCategory ?? DEFAULT_CATEGORY,
          model: defaultModel ?? "",
          tags: inheritedTagsRef.current,
        };

    // 从剪贴板"添加为提示词"是一次明确的新建意图，不该被上次的草稿顶掉。
    const stored = prefillContent ? null : readDraft(draftKey);
    const values = stored && !sameDraft(stored, base) ? stored : base;
    return { base, values, restored: values !== base };
  });

  const [title, setTitle] = useState(initial.values.title);
  const [content, setContent] = useState(initial.values.content);
  const [notes, setNotes] = useState(initial.values.notes);
  const [category, setCategory] = useState<Category>(initial.values.category);
  const [model, setModel] = useState(initial.values.model);
  const [tags, setTags] = useState<string[]>(initial.values.tags);
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(initial.restored);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [modelOpen, setModelOpen] = useState(false);
  const [modelHighlight, setModelHighlight] = useState(-1);

  useFocusTrap(dialogRef, true);

  // 每次改动都落一份草稿到本标签页；回到初值就把草稿删掉，不留垃圾。
  useEffect(() => {
    if (savedRef.current) return;
    const current: FormDraft = { title, content, notes, category, model, tags };
    if (sameDraft(current, initial.base)) {
      clearDraft(draftKey);
      return;
    }
    writeDraft(draftKey, current);
  }, [title, content, notes, category, model, tags, initial.base, draftKey]);

  useEffect(() => {
    suggestOpenRef.current = suggestOpen;
  }, [suggestOpen]);

  useEffect(() => {
    modelOpenRef.current = modelOpen;
  }, [modelOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // 补全下拉打开时，Esc 只该关下拉，不能顺手把整个弹窗也关掉
      if (suggestOpenRef.current || modelOpenRef.current) return;
      onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const suggestions = useMemo(() => {
    const query = tagInput.trim().toLowerCase();
    const pool = tagSuggestions.filter((tag) => !tags.includes(tag));
    // 未输入时给出最常用的几个 —— 让"零输入点选"成立。
    // 否则加个标签得先凭记忆敲字，还得敲得和以前一字不差，
    // 否则同一个项目会裂成 "Deep Space" / "deep-space" / "deepspace" 三份。
    if (!query) return pool.slice(0, MAX_SUGGESTIONS);
    const startsWith = pool.filter((tag) => tag.toLowerCase().startsWith(query));
    const contains = pool.filter(
      (tag) =>
        !tag.toLowerCase().startsWith(query) && tag.toLowerCase().includes(query)
    );
    // 前缀命中优先于子串命中
    return [...startsWith, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [tagInput, tagSuggestions, tags]);

  /**
   * 模型候选。输入即过滤，前缀优先；未输入时把最常用的几个直接摆出来，
   * 让"快捷选择"成立 —— 这是这个字段存在的主要价值。
   */
  const modelQuery = model.trim().toLowerCase();
  const modelOptions = useMemo(() => {
    const pool = modelSuggestions;
    if (!modelQuery) return pool.slice(0, MAX_SUGGESTIONS);
    const startsWith = pool.filter((item) =>
      item.toLowerCase().startsWith(modelQuery)
    );
    const contains = pool.filter(
      (item) =>
        !item.toLowerCase().startsWith(modelQuery) &&
        item.toLowerCase().includes(modelQuery)
    );
    return [...startsWith, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [modelQuery, modelSuggestions]);

  /** 输入了一个库里还没有的写法 —— 提交时它就是"新模型"。 */
  const isNewModel =
    modelQuery.length > 0 &&
    !modelSuggestions.some((item) => item.toLowerCase() === modelQuery);

  const closeModelSuggestions = () => {
    setModelOpen(false);
    setModelHighlight(-1);
  };

  const handleModelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const listOpen = modelOpen && modelOptions.length > 0;

    if (listOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setModelHighlight((h) => (h + 1) % modelOptions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setModelHighlight((h) => (h <= 0 ? modelOptions.length - 1 : h - 1));
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeModelSuggestions();
        return;
      }
      if (e.key === "Enter" && modelHighlight >= 0) {
        e.preventDefault();
        setModel(modelOptions[modelHighlight]);
        closeModelSuggestions();
        return;
      }
    }

    // Enter 在表单里默认是提交。模型框里的 Enter 只用来"确认这个值"，
    // 否则挑模型会把整张表单提前发出去。
    if (e.key === "Enter") {
      e.preventDefault();
      setModel((prev) => prev.trim());
      closeModelSuggestions();
    }
  };

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

  /** 丢弃恢复回来的草稿，退回库里已保存的版本。 */
  const discardDraft = () => {
    setTitle(initial.base.title);
    setContent(initial.base.content);
    setNotes(initial.base.notes);
    setCategory(initial.base.category);
    setModel(initial.base.model);
    setTags(initial.base.tags);
    setTagInput("");
    closeSuggestions();
    closeModelSuggestions();
    setDraftRestored(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const saved = await onSubmit({
        title: title.trim(),
        content: content.trim(),
        notes: notes.trim(),
        category,
        model: model.trim(),
        tags,
      });
      // 只有真的落库成功才清草稿。失败时草稿必须留着 —— 否则一次网络抖动
      // 就把用户刚写完的东西扔了，而这正是这次要修的场景。
      if (saved) {
        savedRef.current = true;
        clearDraft(draftKey);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4"
      // 关闭必须"起手就在遮罩上"。否则在正文里拖选文字、鼠标划出边框再松手，
      // 浏览器会把 click 派发到遮罩（mousedown/mouseup 的共同祖先），整个编辑框就没了。
      onPointerDown={(e) => {
        backdropPressRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const startedOnBackdrop = backdropPressRef.current;
        backdropPressRef.current = false;
        if (startedOnBackdrop && e.target === e.currentTarget) onClose();
      }}
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

        {draftRestored && (
          <div className="flex shrink-0 items-center gap-2 border-b border-accent/20 bg-accent/[0.06] px-5 py-2 text-[11px] text-text-secondary">
            <span aria-hidden="true" className="text-[8px] text-accent">
              ●
            </span>
            <span>已恢复上次未保存的草稿</span>
            <button
              type="button"
              onClick={discardDraft}
              className="ml-auto rounded px-1.5 py-0.5 text-text-muted underline decoration-dotted underline-offset-2 transition hover:text-text-primary"
            >
              丢弃，改用已保存的版本
            </button>
          </div>
        )}

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

            {/* 模型：单独一个单值字段，不是标签。快捷点选已有模型，输入新名字即新建。 */}
            <div>
              <label
                htmlFor="prompt-model"
                className="mb-1.5 block text-[11px] tracking-wider text-text-muted"
              >
                模型
              </label>
              <div className="relative">
                <div
                  className="flex min-h-[42px] items-center gap-2 rounded-lg border border-border-subtle bg-bg-input px-2.5 py-1.5 transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]"
                  onClick={() => modelInputRef.current?.focus()}
                >
                  <span aria-hidden="true" className="shrink-0 text-[10px] text-accent/80">
                    ◇
                  </span>
                  <input
                    id="prompt-model"
                    ref={modelInputRef}
                    type="text"
                    value={model}
                    onChange={(e) => {
                      setModel(sanitizeModelDraft(e.target.value));
                      setModelOpen(true);
                      setModelHighlight(-1);
                    }}
                    onFocus={() => setModelOpen(true)}
                    onKeyDown={handleModelKeyDown}
                    onBlur={() => {
                      setModel((prev) => prev.trim());
                      closeModelSuggestions();
                    }}
                    placeholder="例如 Midjourney / GPT-4o（留空表示不限）"
                    maxLength={PROMPT_LIMITS.model}
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={modelOpen && modelOptions.length > 0}
                    aria-controls="prompt-model-listbox"
                    aria-activedescendant={
                      modelHighlight >= 0
                        ? `prompt-model-option-${modelHighlight}`
                        : undefined
                    }
                    aria-describedby="prompt-model-hint"
                    className="min-w-0 flex-1 bg-transparent py-1 text-sm text-text-primary placeholder-text-muted outline-none"
                  />
                  {model && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModel("");
                        modelInputRef.current?.focus();
                      }}
                      className="shrink-0 rounded px-1 text-text-muted transition hover:text-white"
                      aria-label="清除模型"
                    >
                      ×
                    </button>
                  )}
                </div>

                {modelOpen && modelOptions.length > 0 && (
                  <ul
                    id="prompt-model-listbox"
                    role="listbox"
                    aria-label="模型建议"
                    className="scrollbar-thin absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border-subtle bg-bg-elevated py-1 shadow-lg"
                  >
                    {modelOptions.map((item, index) => (
                      <li
                        key={item}
                        id={`prompt-model-option-${index}`}
                        role="option"
                        aria-selected={index === modelHighlight}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setModel(item);
                          closeModelSuggestions();
                        }}
                        onMouseEnter={() => setModelHighlight(index)}
                        className={`flex cursor-pointer items-center gap-1.5 truncate px-3 py-1.5 font-mono text-[11px] transition ${
                          index === modelHighlight
                            ? "bg-bg-hover text-text-primary"
                            : "text-text-secondary"
                        }`}
                      >
                        <span aria-hidden="true" className="text-[8px] text-accent/60">
                          ◇
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {modelSuggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {modelSuggestions.slice(0, MAX_MODEL_CHIPS).map((item) => {
                    const active = modelQuery === item.toLowerCase();
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setModel(item);
                          closeModelSuggestions();
                        }}
                        aria-pressed={active}
                        title={`使用模型：${item}`}
                        className={`inline-flex max-w-full items-center gap-1 rounded-[5px] border px-1.5 py-0.5 font-mono text-[10px] transition ${
                          active
                            ? "border-accent/55 bg-accent/15 text-text-primary"
                            : "border-white/10 bg-white/[0.04] text-text-muted hover:border-white/25 hover:text-text-secondary"
                        }`}
                      >
                        <span aria-hidden="true" className="text-[8px] text-accent/70">
                          ◇
                        </span>
                        <span className="truncate">{item}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <p id="prompt-model-hint" className="mt-1.5 text-[11px] text-text-muted">
                {isNewModel ? (
                  <span className="text-accent">将新建模型「{model.trim()}」</span>
                ) : (
                  "留空表示不限模型 · 点选已有模型，或直接输入新名字"
                )}
              </p>
            </div>

            <div>
              <label
                htmlFor="prompt-tags"
                className="mb-1.5 block text-[11px] tracking-wider text-text-muted"
              >
                {!prompt && inheritedTagsRef.current.length > 0
                  ? "标签 · 已带入当前筛选"
                  : "标签"}
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
                    placeholder={tags.length === 0 ? "输入或点选下方标签" : ""}
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
