"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult, Prompt, NewPrompt, FilterKey } from "@/lib/types";
import { NAV_ITEMS } from "@/lib/types";
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

interface PendingDelete {
  prompt: Prompt;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Server Action 里的 redirect() 是靠抛一个带 NEXT_REDIRECT 标记的异常实现的，
 * 那属于正常跳转流程（比如会话失效被踢回登录页），不能当成业务失败弹提示。
 */
function isRedirectError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("NEXT_REDIRECT") || message.includes("NEXT_NOT_FOUND");
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

  const pendingDeletesRef = useRef<Map<string, PendingDelete>>(new Map());
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

  const pushToast = useCallback(
    (
      text: string,
      type: "success" | "error" = "success",
      options?: { duration?: number; action?: ToastMessage["action"] }
    ) => {
      const id = (toastIdRef.current += 1);
      setToasts((prev) => [...prev, { id, text, type, action: options?.action }]);
      const timer = setTimeout(
        () => dismissToast(id),
        options?.duration ?? TOAST_DURATION_MS
      );
      toastTimersRef.current.set(id, timer);
      return id;
    },
    [dismissToast]
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

  // 卸载时立刻提交还在犹豫窗口里的删除（不 await：页面正在走，请求发出去就行；
  // 万一被浏览器取消，记录会保留下来 —— 失败方向是安全的）。
  useEffect(() => {
    const pending = pendingDeletesRef.current;
    const timers = toastTimersRef.current;
    return () => {
      pending.forEach((entry) => {
        clearTimeout(entry.timer);
        void deletePrompt(entry.prompt.id).catch(() => undefined);
      });
      pending.clear();
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const filteredPrompts = useMemo(() => {
    let result = prompts;
    if (filter === "favorites") {
      result = result.filter((p) => p.is_favorite);
    } else if (filter !== "all") {
      result = result.filter((p) => p.category === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          (p.notes ?? "").toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [prompts, filter, search]);

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

  const commitDelete = useCallback(
    async (prompt: Prompt) => {
      pendingDeletesRef.current.delete(prompt.id);

      const result = await runAction(
        () => deletePrompt(prompt.id),
        "删除失败"
      );
      if (result === null) {
        // 删除没成功就把记录放回去，别让界面上少一条、库里还留着
        setPrompts((prev) => sortByCreatedDesc([...prev, prompt]));
        return;
      }
      lastRefreshRef.current = Date.now();
    },
    [runAction]
  );

  const undoDelete = useCallback(
    (id: string) => {
      const entry = pendingDeletesRef.current.get(id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pendingDeletesRef.current.delete(id);
      setPrompts((prev) => sortByCreatedDesc([...prev, entry.prompt]));
      pushToast("已恢复");
    },
    [pushToast]
  );

  // 延迟提交 + 撤销。用时间差换掉了原来的 window.confirm —— 既不用弹系统对话框，
  // 也不需要给表加 deleted_at 字段（那会让"还没跑迁移"直接变成线上 500）。
  const handleDelete = useCallback(
    (prompt: Prompt) => {
      setPrompts((prev) => prev.filter((p) => p.id !== prompt.id));

      const timer = setTimeout(() => {
        void commitDelete(prompt);
      }, UNDO_WINDOW_MS);
      pendingDeletesRef.current.set(prompt.id, { prompt, timer });

      const toastId = pushToast(`已删除「${prompt.title}」`, "success", {
        duration: UNDO_WINDOW_MS,
        action: {
          label: "撤销",
          onClick: () => {
            dismissToast(toastId);
            undoDelete(prompt.id);
          },
        },
      });
    },
    [commitDelete, dismissToast, pushToast, undoDelete]
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

  const handleCopy = useCallback(
    async (content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        pushToast("已复制到剪贴板");
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
            <EmptyState onNew={openNewModal} hasPrompts={prompts.length > 0} />
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
}: {
  onNew: () => void;
  hasPrompts: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-border-subtle bg-bg-surface shadow-md">
        <span className="font-display text-4xl italic text-text-muted">P</span>
        <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-accent shadow-[0_0_10px_#ff6b35]" />
      </div>
      <p className="mb-1 font-display text-xl font-medium tracking-wide text-text-primary">
        {hasPrompts ? "没有匹配的档案" : "档案库为空"}
      </p>
      <p className="mb-8 max-w-xs text-sm leading-relaxed text-text-muted">
        {hasPrompts
          ? "尝试切换分类或调整搜索词"
          : "新建你的第一条提示词，或直接复制剪贴板内容"}
      </p>
      <button
        type="button"
        onClick={onNew}
        className="btn h-11 rounded-lg bg-accent px-6 text-white shadow-[0_0_16px_rgba(255,107,53,0.25)] hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-[0_0_24px_rgba(255,107,53,0.4)]"
      >
        新建提示词
      </button>
    </div>
  );
}
