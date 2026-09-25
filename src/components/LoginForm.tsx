"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/lib/auth-actions";
import { AlertIcon, EyeIcon, EyeOffIcon, LockIcon } from "./Icons";

interface LoginFormProps {
  serverConfigured: boolean;
}

export function LoginForm({ serverConfigured }: LoginFormProps) {
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setError(null);

    startTransition(async () => {
      try {
        const result = await loginAction(password);
        if (result.ok) {
          // 整页加载：确保拿到的是登录后的全新服务端渲染，不残留任何旧缓存
          window.location.replace("/");
          return;
        }
        setError(result.error ?? "登录失败，请重试");
      } catch {
        setError("网络异常，请重试");
      }
    });
  };

  return (
    <div className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-9 text-center">
          <div className="mb-2 flex items-baseline justify-center gap-1.5">
            <span className="font-display text-3xl font-semibold tracking-tight text-white">
              Prompt
            </span>
            <span className="font-display text-3xl font-extralight tracking-tight text-text-secondary">
              Vault
            </span>
          </div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
            提示词档案库
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-strong animate-scale-in overflow-hidden rounded-2xl"
          aria-labelledby="login-heading"
        >
          <div
            className="h-1 w-full"
            style={{
              background:
                "linear-gradient(90deg, var(--cat-image-gen), var(--cat-image-edit), var(--cat-video), var(--cat-llm))",
            }}
          />

          <div className="space-y-5 p-6">
            <div className="flex items-center gap-2 text-text-secondary">
              <LockIcon size={15} />
              <h1 id="login-heading" className="text-sm font-medium">
                输入访问密码
              </h1>
            </div>

            <div>
              <label
                htmlFor="vault-password"
                className="mb-1.5 block text-[11px] uppercase tracking-wider text-text-muted"
              >
                密码
              </label>
              <div className="relative">
                <input
                  id="vault-password"
                  name="password"
                  type={revealed ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  autoFocus
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  disabled={!serverConfigured}
                  className="h-11 w-full rounded-lg border border-border-subtle bg-bg-input pl-3.5 pr-11 text-sm text-text-primary placeholder-text-muted transition disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setRevealed((prev) => !prev)}
                  aria-label={revealed ? "隐藏密码" : "显示密码"}
                  aria-pressed={revealed}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-text-muted transition hover:bg-bg-hover hover:text-text-secondary"
                >
                  {revealed ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <p
                id="login-error"
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs leading-relaxed text-red-300"
              >
                <span className="mt-px shrink-0">
                  <AlertIcon size={14} />
                </span>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending || !password || !serverConfigured}
              className="btn h-11 w-full rounded-lg bg-accent text-white shadow-[0_0_16px_rgba(255,107,53,0.25)] transition hover:bg-accent-hover hover:shadow-[0_0_24px_rgba(255,107,53,0.4)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {pending ? "验证中..." : "进入档案库"}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-text-muted">
          登录状态会长期保留，无需重复输入。
          <br />
          此站点已声明不被搜索引擎收录。
        </p>
      </div>
    </div>
  );
}
