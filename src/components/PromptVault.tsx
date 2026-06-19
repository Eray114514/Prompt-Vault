"use client";

import { useState, useMemo, useCallback } from "react";
import type { Prompt, NewPrompt, FilterKey } from "@/lib/types";
import { NAV_ITEMS } from "@/lib/types";
import {
  createPrompt,
  updatePrompt,
  deletePrompt,
  toggleFavorite,
} from "@/lib/actions";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PromptCard } from "./PromptCard";
import { PromptModal } from "./PromptModal";
import { ClipboardDetector } from "./ClipboardDetector";
import { Toast, type ToastMessage } from "./Toast";

interface PromptVaultProps {
  initialPrompts: Prompt[];
}

export function PromptVault({ initialPrompts }: PromptVaultProps) {
  const [prompts, setPrompts] = useState<Prompt[]>(initialPrompts);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [prefillContent, setPrefillContent] = useState<string>("");
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback(
    (text: string, type: "success" | "error" = "success") => {
      const id = Date.now();
      setToast({ id, text, type });
      setTimeout(() => {
        setToast((prev) => (prev?.id === id ? null : prev));
      }, 2500);
    },
    []
  );

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
        map[item.value] = prompts.filter(
          (p) => p.category === item.value
        ).length;
      }
    }
    return map;
  }, [prompts]);

  const handleCreate = useCallback(
    async (data: NewPrompt) => {
      try {
        const newPrompt = await createPrompt(data);
        setPrompts((prev) => [newPrompt, ...prev]);
        setModalOpen(false);
        setEditingPrompt(null);
        setPrefillContent("");
        showToast("已添加提示词");
      } catch (e) {
        showToast("添加失败：" + (e as Error).message, "error");
      }
    },
    [showToast]
  );

  const handleUpdate = useCallback(
    async (id: string, data: NewPrompt) => {
      try {
        const updated = await updatePrompt(id, data);
        setPrompts((prev) => prev.map((p) => (p.id === id ? updated : p)));
        setModalOpen(false);
        setEditingPrompt(null);
        showToast("已更新");
      } catch (e) {
        showToast("更新失败：" + (e as Error).message, "error");
      }
    },
    [showToast]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deletePrompt(id);
        setPrompts((prev) => prev.filter((p) => p.id !== id));
        showToast("已删除");
      } catch (e) {
        showToast("删除失败：" + (e as Error).message, "error");
      }
    },
    [showToast]
  );

  const handleToggleFavorite = useCallback(
    async (id: string, current: boolean) => {
      setPrompts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, is_favorite: !current } : p
        )
      );
      try {
        await toggleFavorite(id, !current);
      } catch {
        setPrompts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, is_favorite: current } : p))
        );
        showToast("操作失败", "error");
      }
    },
    [showToast]
  );

  const handleCopy = useCallback(
    async (content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        showToast("已复制到剪贴板");
      } catch {
        showToast("复制失败", "error");
      }
    },
    [showToast]
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
      if (editingPrompt) {
        return handleUpdate(editingPrompt.id, data);
      }
      return handleCreate(data);
    },
    [editingPrompt, handleCreate, handleUpdate]
  );

  return (
    <div className="relative z-10 flex h-screen overflow-hidden">
      <Sidebar filter={filter} onFilterChange={setFilter} counts={counts} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          search={search}
          onSearchChange={setSearch}
          onNew={openNewModal}
          resultCount={filteredPrompts.length}
        />
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {filteredPrompts.length === 0 ? (
            <EmptyState
              onNew={openNewModal}
              hasPrompts={prompts.length > 0}
            />
          ) : (
            <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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

      {toast && <Toast message={toast} />}
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
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-border-subtle bg-bg-surface shadow-md">
        <span className="font-display text-4xl italic text-text-muted">P</span>
        <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-accent shadow-[0_0_10px_#ff6b35]" />
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
        onClick={onNew}
        className="btn h-11 rounded-lg bg-accent px-6 text-white shadow-[0_0_16px_rgba(255,107,53,0.25)] hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-[0_0_24px_rgba(255,107,53,0.4)]"
      >
        新建提示词
      </button>
    </div>
  );
}
