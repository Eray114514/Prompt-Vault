"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { NAV_ITEMS, type FilterKey, type Category } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/types";
import { logoutAction } from "@/lib/auth-actions";
import { NavIcon, CodeIcon, LogOutIcon, CloseIcon } from "./Icons";

interface SidebarProps {
  filter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
  counts: Record<string, number>;
  /** 移动端抽屉是否展开。lg 以上忽略此值，侧栏常驻。 */
  open: boolean;
  onClose: () => void;
}

function isCategory(value: FilterKey): value is Category {
  return value !== "all" && value !== "favorites";
}

/** 用原生断点判断是否处于桌面布局，决定抽屉要不要从可访问性树里摘掉。 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

export function Sidebar({
  filter,
  onFilterChange,
  counts,
  open,
  onClose,
}: SidebarProps) {
  const isDesktop = useIsDesktop();
  const [loggingOut, startLogout] = useTransition();
  const hiddenOnMobile = !isDesktop && !open;

  const handleLogout = () => {
    startLogout(async () => {
      await logoutAction();
      window.location.replace("/login");
    });
  };

  return (
    <>
      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="分类导航"
        {...(hiddenOnMobile ? { inert: "" as unknown as boolean } : {})}
        className={`glass fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border-subtle/60 transition-transform duration-300 ease-out lg:static lg:z-auto lg:w-60 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* 侧边栏顶部 logo */}
        <div className="relative px-6 pb-6 pt-7">
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
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭导航"
            className="absolute right-3 top-6 rounded-md p-1.5 text-text-muted transition hover:bg-bg-hover hover:text-text-primary lg:hidden"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* 导航抽屉 */}
        <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const active = filter === item.value;
            const count = counts[item.value] ?? 0;
            const catColor = isCategory(item.value)
              ? CATEGORY_COLORS[item.value]
              : null;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  onFilterChange(item.value);
                  onClose();
                }}
                aria-current={active ? "true" : undefined}
                className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-lg px-3.5 py-2.5 text-sm transition-all duration-200 ${
                  active
                    ? "bg-bg-elevated text-white shadow-md"
                    : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                {/* 左侧分类指示条：正确的用法（小面积 + 仅激活态），只把半径收一点 */}
                {catColor && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full transition-all duration-200"
                    style={{
                      backgroundColor: catColor,
                      opacity: active ? 1 : 0,
                      boxShadow: active ? `0 0 6px ${catColor}` : "none",
                    }}
                  />
                )}
                {item.value === "favorites" && active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-fav shadow-[0_0_6px_var(--fav)]"
                  />
                )}
                {item.value === "all" && active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)]"
                  />
                )}

                <span
                  aria-hidden="true"
                  className={`transition-colors duration-200 ${
                    active
                      ? "text-white"
                      : "text-text-muted group-hover:text-text-primary"
                  }`}
                >
                  <NavIcon name={item.icon} size={17} />
                </span>
                <span className="flex-1 text-left font-medium">{item.label}</span>
                {count > 0 && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[11px] tabular-nums transition-colors ${
                      active ? "bg-white/10 text-white" : "bg-bg-hover text-text-muted"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* 底部信息 */}
        <div className="border-t border-border-subtle/60 px-6 py-4">
          <p className="text-[11px] leading-relaxed text-text-muted">
            个人提示词管理
            <br />
            Supabase 多端同步
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Link
              href="/api-docs"
              className="inline-flex items-center gap-1 text-[11px] text-text-muted transition hover:text-text-secondary"
            >
              <CodeIcon size={11} />
              API 文档
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-1 text-[11px] text-text-muted transition hover:text-text-secondary disabled:opacity-50"
            >
              <LogOutIcon size={11} />
              {loggingOut ? "退出中..." : "退出登录"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
