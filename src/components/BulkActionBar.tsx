"use client";

import { useState } from "react";
import { PROMPT_LIMITS } from "@/lib/types";
import { sanitizeModelDraft } from "@/lib/prompts";

interface BulkActionBarProps {
  /** 当前选中的条数（可能包含被筛掉的条目） */
  count: number;
  /** 选中项里有多少条落在当前筛选结果中 */
  visibleSelectedCount: number;
  /** 当前筛选结果里有多少条 */
  visibleCount: number;
  /** 当前筛选结果是否已全选 */
  allVisibleSelected: boolean;
  /** 已有模型，供输入框的 datalist 快速选择 */
  modelSuggestions: string[];
  busy: boolean;
  onToggleSelectAll: () => void;
  /** 空字符串 = 清除模型 */
  onApplyModel: (model: string) => void;
  onSetFavorite: (value: boolean) => void;
  onExit: () => void;
}

const secondaryButton =
  "btn h-8 shrink-0 rounded-md border border-border-subtle px-2.5 text-[11px] text-text-secondary transition hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40";

/**
 * 批量操作条。
 *
 * 固定在底部而不是放在顶栏：选择发生在卡片区，操作按钮就该在视线落点的另一端，
 * 并且滚动时始终可达。模型输入用原生 datalist —— 这里只需要"从已有名单里挑一个
 * 或敲一个新的"，不值得再实现一套下拉。
 */
export function BulkActionBar({
  count,
  visibleSelectedCount,
  visibleCount,
  allVisibleSelected,
  modelSuggestions,
  busy,
  onToggleSelectAll,
  onApplyModel,
  onSetFavorite,
  onExit,
}: BulkActionBarProps) {
  const [modelInput, setModelInput] = useState("");
  const trimmed = modelInput.trim();
  const disabled = busy || count === 0;
  const hiddenSelected = Math.max(count - visibleSelectedCount, 0);

  const applyModel = () => {
    if (disabled) return;
    onApplyModel(trimmed);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-3 sm:bottom-5 sm:px-6">
      <div
        role="region"
        aria-label="批量操作"
        className="glass-strong pointer-events-auto flex w-full max-w-4xl flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border-default px-3 py-2.5 shadow-2xl sm:px-4"
      >
        <span className="shrink-0 text-xs text-text-secondary" aria-live="polite">
          已选 <b className="tabular-nums text-text-primary">{count}</b> 条
          {hiddenSelected > 0 && (
            <span className="ml-1 text-[10px] text-text-muted">
              （含 {hiddenSelected} 条不在当前筛选）
            </span>
          )}
        </span>

        <button
          type="button"
          onClick={onToggleSelectAll}
          disabled={busy || visibleCount === 0}
          className={secondaryButton}
        >
          {allVisibleSelected ? "取消全选" : "全选当前"}
          <span className="ml-1 tabular-nums opacity-60">· {visibleCount}</span>
        </button>

        <span aria-hidden="true" className="hidden h-5 w-px bg-border-subtle sm:block" />

        <div className="flex min-w-[200px] flex-1 items-center gap-1.5">
          <span aria-hidden="true" className="shrink-0 text-[10px] text-accent/80">
            ◇
          </span>
          <input
            type="text"
            list="bulk-model-options"
            value={modelInput}
            onChange={(e) => setModelInput(sanitizeModelDraft(e.target.value))}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              // 条不是表单，但 Enter 仍然应该"确认"而不是什么都不发生
              e.preventDefault();
              applyModel();
            }}
            placeholder="模型名，留空则清除"
            aria-label="批量设置模型"
            maxLength={PROMPT_LIMITS.model}
            disabled={busy || count === 0}
            autoComplete="off"
            className="h-8 min-w-0 flex-1 rounded-md border border-border-subtle bg-bg-input px-2.5 text-xs text-text-primary placeholder-text-muted transition focus:border-accent disabled:opacity-40"
          />
          <datalist id="bulk-model-options">
            {modelSuggestions.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={applyModel}
            disabled={disabled}
            className="btn h-8 shrink-0 rounded-md bg-accent px-3 text-[11px] text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {trimmed ? "设为该模型" : "清除模型"}
          </button>
        </div>

        <span aria-hidden="true" className="hidden h-5 w-px bg-border-subtle sm:block" />

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSetFavorite(true)}
            disabled={disabled}
            className={secondaryButton}
          >
            收藏
          </button>
          <button
            type="button"
            onClick={() => onSetFavorite(false)}
            disabled={disabled}
            className={secondaryButton}
          >
            取消收藏
          </button>
          <button
            type="button"
            onClick={onExit}
            disabled={busy}
            className={secondaryButton}
          >
            退出批量
          </button>
        </div>
      </div>
    </div>
  );
}
