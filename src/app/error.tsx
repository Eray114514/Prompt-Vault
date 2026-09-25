"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Prompt Vault] 页面渲染失败：", error);
  }, [error]);

  const unauthorized =
    error.name === "UnauthorizedError" || error.message === "UNAUTHORIZED";

  return (
    <div className="relative z-10 flex h-[100dvh] items-center justify-center px-6">
      <div className="glass-strong w-full max-w-md rounded-2xl p-7 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-border-subtle bg-bg-surface">
          <span className="font-display text-2xl italic text-text-muted">!</span>
        </div>

        <h1 className="mb-2 font-display text-xl font-medium tracking-wide text-text-primary">
          {unauthorized ? "登录状态已失效" : "出了点问题"}
        </h1>

        <p className="mb-7 text-sm leading-relaxed text-text-muted">
          {unauthorized
            ? "可能密码被更改过，请重新登录。"
            : "读取数据时出错。可以先重试；如果一直失败，多半是 Supabase 连接或环境变量的问题。"}
        </p>

        {!unauthorized && (
          <p className="mb-6 break-words rounded-lg border border-border-subtle/60 bg-bg-base/60 px-3 py-2 text-left font-mono text-[11px] leading-relaxed text-text-muted">
            {error.message}
            {error.digest ? ` (digest: ${error.digest})` : ""}
          </p>
        )}

        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={unauthorized ? () => window.location.assign("/login") : reset}
            className="btn h-10 rounded-lg bg-accent px-6 text-white shadow-[0_0_16px_rgba(255,107,53,0.25)] hover:bg-accent-hover"
          >
            {unauthorized ? "去登录" : "重试"}
          </button>
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            className="btn h-10 rounded-lg border border-border-subtle px-5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            回到首页
          </button>
        </div>
      </div>
    </div>
  );
}
