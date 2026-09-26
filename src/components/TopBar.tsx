"use client";

import { SearchIcon, PlusIcon, MenuIcon } from "./Icons";

interface TopBarProps {
  search: string;
  onSearchChange: (s: string) => void;
  onNew: () => void;
  onOpenSidebar: () => void;
  resultCount: number;
}

export function TopBar({
  search,
  onSearchChange,
  onNew,
  onOpenSidebar,
  resultCount,
}: TopBarProps) {
  return (
    <header className="flex items-center gap-3 px-4 py-4 sm:gap-5 sm:px-8 sm:py-5">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="打开导航"
        className="btn shrink-0 rounded-lg border border-border-subtle p-2.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary lg:hidden"
      >
        <MenuIcon size={18} />
      </button>

      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <SearchIcon
          size={15}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索标题、内容、标签..."
          aria-label="搜索提示词"
          className="h-10 w-full rounded-lg border border-border-subtle bg-bg-input pl-10 pr-4 text-sm text-text-primary placeholder-text-muted transition focus:border-accent"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span
          aria-live="polite"
          className="hidden rounded-md bg-bg-elevated px-2.5 py-1 text-xs tabular-nums text-text-muted sm:inline-block"
        >
          {resultCount} 条
        </span>
        <button
          type="button"
          onClick={onNew}
          className="btn glow-accent h-10 rounded-lg bg-accent px-3 text-white hover:-translate-y-0.5 hover:bg-accent-hover sm:px-5"
        >
          <PlusIcon size={16} />
          <span className="hidden sm:inline">新建提示词</span>
          <span className="sr-only sm:hidden">新建提示词</span>
        </button>
      </div>
    </header>
  );
}
