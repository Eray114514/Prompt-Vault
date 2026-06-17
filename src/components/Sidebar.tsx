"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, type FilterKey, type Category } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/types";
import { NavIcon } from "./Icons";

interface SidebarProps {
  filter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
  counts: Record<string, number>;
}

function isCategory(value: FilterKey): value is Category {
  return value !== "all" && value !== "favorites";
}

export function Sidebar({ filter, onFilterChange, counts }: SidebarProps) {
  const pathname = usePathname();
  const docsActive = pathname === "/api-docs";

  return (
    <aside className="glass relative flex w-60 shrink-0 flex-col border-r border-border-subtle/60">
      {/* 侧边栏顶部 logo */}
      <div className="relative px-6 pt-7 pb-6">
        <div className="mb-1 flex items-baseline gap-1.5">
          <span className="font-display text-2xl font-semibold tracking-tight text-white">
            Prompt
          </span>
          <span className="font-display text-2xl font-extralight tracking-tight text-text-secondary">
            Vault
          </span>
        </div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
          提示词档案库
        </p>
      </div>

      {/* 导航抽屉 */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = filter === item.value;
          const count = counts[item.value] ?? 0;
          const catColor = isCategory(item.value)
            ? CATEGORY_COLORS[item.value]
            : null;

          return (
            <button
              key={item.value}
              onClick={() => onFilterChange(item.value)}
              className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-lg px-3.5 py-2.5 text-sm transition-all duration-200 ${
                active
                  ? "bg-bg-elevated text-white shadow-md"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`}
            >
              {/* 左侧霓虹指示条 */}
              {catColor && (
                <span
                  className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full transition-all duration-200"
                  style={{
                    backgroundColor: catColor,
                    opacity: active ? 1 : 0,
                    boxShadow: active ? `0 0 10px ${catColor}` : "none",
                  }}
                />
              )}
              {item.value === "favorites" && active && (
                <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-fav shadow-[0_0_10px_#ffd600]" />
              )}
              {item.value === "all" && active && (
                <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
              )}

              <span
                className={`transition-colors duration-200 ${
                  active ? "text-white" : "text-text-muted group-hover:text-text-primary"
                }`}
              >
                <NavIcon name={item.icon} size={17} />
              </span>
              <span className="flex-1 text-left font-medium">{item.label}</span>
              {count > 0 && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums transition-colors ${
                    active
                      ? "bg-white/10 text-white"
                      : "bg-bg-hover text-text-muted"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* API 文档入口 */}
      <div className="border-t border-border-subtle/60 px-3 py-3">
        <Link
          href="/api-docs"
          className={`group flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm transition-all duration-200 ${
            docsActive
              ? "bg-bg-elevated text-white shadow-md"
              : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          }`}
        >
          <span
            className={`transition-colors duration-200 ${
              docsActive
                ? "text-white"
                : "text-text-muted group-hover:text-text-primary"
            }`}
          >
            <NavIcon name="code" size={17} />
          </span>
          <span className="flex-1 text-left font-medium">API 文档</span>
        </Link>
      </div>

      {/* 底部信息 */}
      <div className="border-t border-border-subtle/60 px-6 py-4">
        <p className="text-[10px] leading-relaxed text-text-muted">
          个人提示词管理
          <br />
          Supabase 多端同步
        </p>
      </div>
    </aside>
  );
}
