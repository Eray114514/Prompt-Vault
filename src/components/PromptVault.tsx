"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult, Prompt, NewPrompt, FilterKey } from "@/lib/types";
import { CATEGORY_LABELS, NAV_ITEMS } from "@/lib/types";
import {
  createPrompt,
  updatePrompt,
  deletePrompt,
  toggleFavorite,
} from "@/lib/actions";
import { sortByCreatedDesc } from "@/lib/prompts";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PromptCard } from "./PromptCard";
import { PromptModal } from "./PromptModal";
import { ClipboardDetector } from "./ClipboardDetector";
import { ToastStack, type ToastMessage } from "./Toast";

interface PromptVaultProps {
  initialPrompts: Prompt[];
}

/** 删除的犹豫窗口：这段时间内可以撤销，到点才真正落库。 */
const UNDO_WINDOW_MS = 6000;
/** 窗口重新聚焦时的刷新节流，避免切来切去疯狂打 Supabase。 */
const REFRESH_THROTTLE_MS = 15000;
const TOAST_DURATION_MS = 2600;

/** 搜索：标题 / 正文 / 备注 / 标签之间的 OR 子串匹配。空查询视为命中。 */
function matchesSearch(prompt: Prompt, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    prompt.title.toLowerCase().includes(q) ||
    prompt.content.toLowerCase().includes(q) ||
    (prompt.notes ?? "").toLowerCase().includes(q) ||
    prompt.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

function matchesCategoryFilter(prompt: Prompt, filter: FilterKey): boolean {
  if (filter === "favorites") return prompt.is_favorite;
  if (filter === "all") return true;
  return prompt.category === filter;
}

/**
 * Server Action 里的 redirect() 是靠抛一个带 NEXT_REDIRECT 标记的异常实现的，
 * 那属于正常跳转流程（比如会话失效被踢回登录页），不能当成业务失败弹提示。
 */
function isRedirectError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("NEXT_REDIRECT") || message.includes("NEXT_NOT_FOUND");
}

/** 空结果时给出的"放宽条件后能找到什么"的可点出口。 */
interface ReliefOption {
  key: string;
  label: string;
  count: number;
  apply: () => void;
}

export function PromptVault({ initialPrompts }: PromptVaultProps) {
  const router = useRouter();
  const [prompts, setPrompts] = useState<Prompt[]>(() =>
    sortByCreatedDesc(initialPrompts)
  );
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [prefillContent, setPrefillContent] = useState<string>("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 待删除的批次。刻意只留一个批次定时器：连删多条合并成一次提交 + 一次撤销，
  // 而不是每条各弹一个带按钮的 toast（那会变成视觉噪音）。
  const pendingDeletesRef = useRef<Map<string, Prompt>>(new Map());
  const deleteBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteToastIdRef = useRef<number | null>(null);

  const toastIdRef = useRef(0);
  const toastTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const lastRefreshRef = useRef(Date.now());

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const armToastTimer = useCallback(
    (id: number, duration: number) => {
      const existing = toastTimersRef.current.get(id);
      if (existing) clearTimeout(existing);
      toastTimersRef.current.set(
        id,
        setTimeout(() => dismissToast(id), duration)
      );
    },
    [dismissToast]
  );

  const pushToast = useCallback(
    (
      text: string,
      type: "success" | "error" = "success",
      options?: { duration?: number; action?: ToastMessage["action"] }
    ) => {
      const id = (toastIdRef.current += 1);
      setToasts((prev) => [...prev, { id, text, type, action: options?.action }]);
      armToastTimer(id, options?.duration ?? TOAST_DURATION_MS);
      return id;
    },
    [armToastTimer]
  );

  /** 原地更新已有 toast（用于"已删除 1 条"→"已删除 3 条"这种累积文案）。 */
  const updateToast = useCallback(
    (id: number, patch: Partial<Omit<ToastMessage, "id">>, duration?: number) => {
      setToasts((prev) =>
        prev.map((toast) => (toast.id === id ? { ...toast, ...patch } : toast))
      );
      if (duration !== undefined) armToastTimer(id, duration);
    },
    [armToastTimer]
  );

  /** 统一处理 Server Action 的返回：失败弹提示并返回 null，成功把 data 交出去。 */
  const runAction = useCallback(
    async <T,>(
      action: () => Promise<ActionResult<T>>,
      fallback: string
    ): Promise<T | null> => {
      try {
        const result = await action();
        if (!result.ok) {
          pushToast(`${fallback}：${result.error}`, "error");
          return null;
        }
        return result.data;
      } catch (error) {
        if (isRedirectError(error)) return null;
        const message = error instanceof Error ? error.message : "未知错误";
        pushToast(`${fallback}：${message}`, "error");
        return null;
      }
    },
    [pushToast]
  );

  // 服务端重新渲染后把本地状态对齐。
  // 旧实现只在挂载时消费 initialPrompts，所以别的设备改了这里永远看不到 ——
  // "多端同步"这个卖点实际上只在手动刷新页面时成立。
  useEffect(() => {
    setPrompts(sortByCreatedDesc(initialPrompts));
  }, [initialPrompts]);

  // 窗口重新获得焦点时拉一次最新数据，让多端同步真正生效。
  useEffect(() => {
    const maybeRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (pendingDeletesRef.current.size > 0) return;
      if (Date.now() - lastRefreshRef.current < REFRESH_THROTTLE_MS) return;
      lastRefreshRef.current = Date.now();
      router.refresh();
    };

    window.addEventListener("focus", maybeRefresh);
    document.addEventListener("visibilitychange", maybeRefresh);
    return () => {
      window.removeEventListener("focus", maybeRefresh);
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, [router]);

  // 卸载时把还在犹豫窗口里的删除一次性提交出去（不 await：页面正在走，
  // 请求发出去就行；万一被浏览器取消，记录会保留 —— 失败方向是安全的）。
  useEffect(() => {
    const pending = pendingDeletesRef.current;
    const toastTimers = toastTimersRef.current;
    return () => {
      if (deleteBatchTimerRef.current) clearTimeout(deleteBatchTimerRef.current);
      pending.forEach((_prompt, id) => {
        void deletePrompt(id).catch(() => undefined);
      });
      pending.clear();
      toastTimers.forEach((timer) => clearTimeout(timer));
      toastTimers.clear();
    };
  }, []);

  const filteredPrompts = useMemo(
    () =>
      prompts.filter(
        (p) => matchesCategoryFilter(p, filter) && matchesSearch(p, search)
      ),
    [prompts, filter, search]
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = {
      all: prompts.length,
      favorites: prompts.filter((p) => p.is_favorite).length,
    };
    for (const item of NAV_ITEMS) {
      if (item.value !== "all" && item.value !== "favorites") {
        map[item.value] = prompts.filter((p) => p.category === item.value).length;
      }
    }
    return map;
  }, [prompts]);

  const filterLabel = useMemo(() => {
    if (filter === "all") return "全部";
    if (filter === "favorites") return "收藏";
    return CATEGORY_LABELS[filter];
  }, [filter]);

  /** 在给定的放宽条件下有多少命中。用于空结果时给可点的出口。 */
  const countMatching = useCallback(
    (next: { search: string; filter: FilterKey }) =>
      prompts.filter(
        (p) =>
          matchesCategoryFilter(p, next.filter) && matchesSearch(p, next.search)
      ).length,
    [prompts]
  );

  // 空结果时，逐级放宽当前条件，给出真正有命中的方向。
  // 原来这里只有一句"尝试切换分类或调整搜索词"的静态文案 —— 它告诉你该做什么，
  // 却不给你按钮，等于把活留给用户。
  const reliefOptions = useMemo<ReliefOption[]>(() => {
    if (prompts.length === 0) return [];
    if (filteredPrompts.length > 0) return [];

    const hasSearch = search.trim().length > 0;
    const hasCategory = filter !== "all";
    const options: ReliefOption[] = [];

    if (hasCategory && hasSearch) {
      const count = countMatching({ search, filter: "all" });
      if (count > 0) {
        options.push({
          key: "drop-category",
          label: "在全部分类中搜索",
          count,
          apply: () => setFilter("all"),
        });
      }
    }

    if (hasSearch) {
      const count = countMatching({ search: "", filter });
      if (count > 0) {
        options.push({
          key: "drop-search",
          label: hasCategory ? `只看「${filterLabel}」` : "清空搜索词",
          count,
          apply: () => setSearch(""),
        });
      }
    }

    if (hasCategory || hasSearch) {
      options.push({
        key: "reset",
        label: "查看全部档案",
        count: prompts.length,
        apply: () => {
          setSearch("");
          setFilter("all");
        },
      });
    }

    return options.slice(0, 2);
  }, [prompts, filteredPrompts.length, filter, search, filterLabel, countMatching]);

  const handleCreate = useCallback(
    async (data: NewPrompt) => {
      const created = await runAction(() => createPrompt(data), "添加失败");
      if (!created) return;

      setPrompts((prev) => sortByCreatedDesc([created, ...prev]));
      setModalOpen(false);
      setEditingPrompt(null);
      setPrefillContent("");
      pushToast("已添加提示词");
      lastRefreshRef.current = Date.now();
      router.refresh();
    },
    [runAction, pushToast, router]
  );

  const handleUpdate = useCallback(
    async (id: string, data: NewPrompt) => {
      const updated = await runAction(
        () => updatePrompt(id, data),
        "更新失败"
      );
      if (!updated) return;

      setPrompts((prev) =>
        sortByCreatedDesc(prev.map((p) => (p.id === id ? updated : p)))
      );
      setModalOpen(false);
      setEditingPrompt(null);
      pushToast("已更新");
      lastRefreshRef.current = Date.now();
      router.refresh();
    },
    [runAction, pushToast, router]
  );

  /** 把当前整批待删除一次性落库。失败的放回列表，不让界面上少一条而库里还留着。 */
  const commitPendingDeletes = useCallback(async () => {
    const entries = Array.from(pendingDeletesRef.current.entries());
    pendingDeletesRef.current.clear();

    if (deleteBatchTimerRef.current) {
      clearTimeout(deleteBatchTimerRef.current);
      deleteBatchTimerRef.current = null;
    }
    const toastId = deleteToastIdRef.current;
    deleteToastIdRef.current = null;
    if (toastId !== null) dismissToast(toastId);

    if (entries.length === 0) return;

    const results = await Promise.all(
      entries.map(async ([id]) => {
        try {
          const result = await deletePrompt(id);
          return { id, ok: result.ok };
        } catch {
          // 会话失效会走到这里（redirect 靠抛异常实现），本地回滚一下即可
          return { id, ok: false };
        }
      })
    );

    const failedIds = new Set(results.filter((r) => !r.ok).map((r) => r.id));
    if (failedIds.size === 0) {
      lastRefreshRef.current = Date.now();
      return;
    }

    const restore = entries
      .filter(([id]) => failedIds.has(id))
      .map(([, prompt]) => prompt);
    setPrompts((prev) => sortByCreatedDesc([...prev, ...restore]));
    pushToast(`${failedIds.size} 条删除失败，已恢复`, "error");
  }, [dismissToast, pushToast]);

  const undoPendingDeletes = useCallback(() => {
    const restore = Array.from(pendingDeletesRef.current.values());
    pendingDeletesRef.current.clear();

    if (deleteBatchTimerRef.current) {
      clearTimeout(deleteBatchTimerRef.current);
      deleteBatchTimerRef.current = null;
    }
    const toastId = deleteToastIdRef.current;
    deleteToastIdRef.current = null;
    if (toastId !== null) dismissToast(toastId);

    if (restore.length === 0) return;
    setPrompts((prev) => sortByCreatedDesc([...prev, ...restore]));
    pushToast(restore.length === 1 ? "已恢复" : `已恢复 ${restore.length} 条`);
  }, [dismissToast, pushToast]);

  // 延迟提交 + 撤销。用时间差换掉了原来的 window.confirm —— 既不用弹系统对话框，
  // 也不需要给表加 deleted_at 字段（那会让"还没跑迁移"直接变成线上 500）。
  //
  // 连删时合并为一个批次：文案累积成"已删除 N 条"，落库时机顺延到最后一次删除之后。
  const handleDelete = useCallback(
    (prompt: Prompt) => {
      setPrompts((prev) => prev.filter((p) => p.id !== prompt.id));
      pendingDeletesRef.current.set(prompt.id, prompt);

      if (deleteBatchTimerRef.current) clearTimeout(deleteBatchTimerRef.current);
      deleteBatchTimerRef.current = setTimeout(() => {
        void commitPendingDeletes();
      }, UNDO_WINDOW_MS);

      const count = pendingDeletesRef.current.size;
      const text = count === 1 ? `已删除「${prompt.title}」` : `已删除 ${count} 条`;
      const action = {
        label: count === 1 ? "撤销" : "撤销全部",
        onClick: undoPendingDeletes,
      };

      if (deleteToastIdRef.current === null) {
        deleteToastIdRef.current = pushToast(text, "success", {
          duration: UNDO_WINDOW_MS,
          action,
        });
      } else {
        updateToast(deleteToastIdRef.current, { text, action }, UNDO_WINDOW_MS);
      }
    },
    [commitPendingDeletes, pushToast, undoPendingDeletes, updateToast]
  );

  const handleToggleFavorite = useCallback(
    async (id: string, current: boolean) => {
      setPrompts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_favorite: !current } : p))
      );

      try {
        const result = await toggleFavorite(id, !current);
        if (!result.ok) {
          setPrompts((prev) =>
            prev.map((p) => (p.id === id ? { ...p, is_favorite: current } : p))
          );
          pushToast(`操作失败：${result.error}`, "error");
        }
      } catch (error) {
        if (isRedirectError(error)) return;
        setPrompts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, is_favorite: current } : p))
        );
        pushToast("操作失败", "error");
      }
    },
    [pushToast]
  );

  // 成功路径刻意不弹 toast：卡片上的按钮已经有"已复制 + 一圈脉冲"的局部反馈，
  // 再补一个屏幕底部的全局提示只会让人跳视线。失败仍然要弹 —— 它没有别的地方可显示。
  const handleCopy = useCallback(
    async (content: string) => {
      try {
        await navigator.clipboard.writeText(content);
      } catch {
        pushToast("复制失败", "error");
      }
    },
    [pushToast]
  );

  const openNewModal = useCallback(() => {
    setEditingPrompt(null);
    setPrefillContent("");
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((prompt: Prompt) => {
    setEditingPrompt(prompt);
    setPrefillContent("");
    setModalOpen(true);
  }, []);

  const handleClipboardDetect = useCallback((content: string) => {
    setPrefillContent(content);
    setEditingPrompt(null);
    setModalOpen(true);
  }, []);

  const handleSubmit = useCallback(
    (data: NewPrompt) => {
      if (editingPrompt) return handleUpdate(editingPrompt.id, data);
      return handleCreate(data);
    },
    [editingPrompt, handleCreate, handleUpdate]
  );

  return (
    <div className="relative z-10 flex h-[100dvh] overflow-hidden">
      <Sidebar
        filter={filter}
        onFilterChange={setFilter}
        counts={counts}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          search={search}
          onSearchChange={setSearch}
          onNew={openNewModal}
          onOpenSidebar={() => setSidebarOpen(true)}
          resultCount={filteredPrompts.length}
        />

        <div className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-8 sm:px-8">
          {filteredPrompts.length === 0 ? (
            <EmptyState
              onNew={openNewModal}
              hasPrompts={prompts.length > 0}
              reliefOptions={reliefOptions}
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredPrompts.map((prompt, idx) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  index={idx}
                  onCopy={handleCopy}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {modalOpen && (
        <PromptModal
          prompt={editingPrompt}
          defaultCategory={
            filter !== "all" && filter !== "favorites" ? filter : undefined
          }
          prefillContent={prefillContent}
          onSubmit={handleSubmit}
          onClose={() => {
            setModalOpen(false);
            setEditingPrompt(null);
            setPrefillContent("");
          }}
        />
      )}

      <ClipboardDetector
        onDetect={handleClipboardDetect}
        existingPrompts={prompts}
      />

      <ToastStack messages={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function EmptyState({
  onNew,
  hasPrompts,
  reliefOptions,
}: {
  onNew: () => void;
  hasPrompts: boolean;
  reliefOptions: ReliefOption[];
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-border-subtle bg-bg-surface shadow-md">
        <span className="font-display text-4xl italic text-text-muted">P</span>
        <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-accent shadow-[0_0_10px_var(--accent-glow)]" />
      </div>
      <p className="mb-1 font-display text-xl font-medium tracking-wide text-text-primary">
        {hasPrompts ? "没有匹配的档案" : "档案库为空"}
      </p>

      {hasPrompts ? (
        reliefOptions.length > 0 ? (
          <div className="mb-8 flex flex-col items-center gap-2">
            {reliefOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={option.apply}
                className="btn rounded-lg border border-border-subtle bg-bg-surface px-4 py-2 text-sm text-text-secondary transition hover:border-border-hover hover:text-text-primary"
              >
                {option.label}
                <span className="ml-1 tabular-nums text-text-muted">
                  · {option.count} 条
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mb-8 max-w-xs text-sm leading-relaxed text-text-muted">
            尝试切换分类或调整搜索词
          </p>
        )
      ) : (
        <p className="mb-8 max-w-xs text-sm leading-relaxed text-text-muted">
          新建你的第一条提示词，或直接复制剪贴板内容
        </p>
      )}

      <button
        type="button"
        onClick={onNew}
        className="btn glow-accent h-11 rounded-lg bg-accent px-6 text-white hover:-translate-y-0.5 hover:bg-accent-hover"
      >
        新建提示词
      </button>
    </div>
  );
}
