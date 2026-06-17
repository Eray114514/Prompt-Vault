"use client";

import { SearchIcon, PlusIcon } from "./Icons";

interface TopBarProps {
  search: string;
  onSearchChange: (s: string) => void;
  onNew: () => void;
  resultCount: number;
}

export function TopBar({
  search,
  onSearchChange,
  onNew,
  resultCount,
}: TopBarProps) {
  return (
    <header className="flex items-center gap-5 px-8 py-5">
      <div className="relative max-w-md flex-1">
        <SearchIcon
          size={15}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索标题、内容、标签..."
          className="h-10 w-full rounded-lg border border-border-subtle bg-bg-input pl-10 pr-4 text-sm text-text-primary placeholder-text-muted transition focus:border-accent"
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="rounded-md bg-bg-elevated px-2.5 py-1 text-xs tabular-nums text-text-muted">
          {resultCount} 条
        </span>
        <button
          onClick={onNew}
          className="btn h-10 rounded-lg bg-accent px-5 text-white shadow-[0_0_16px_rgba(255,107,53,0.25)] hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-[0_0_24px_rgba(255,107,53,0.4)]"
        >
          <PlusIcon size={16} />
          新建提示词
        </button>
      </div>
    </header>
  );
}
