"use server";

import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  createSessionToken,
  isAuthConfigured,
  sessionCookieOptions,
  verifyPassword,
} from "./auth";

export interface LoginResult {
  ok: boolean;
  error?: string;
}

/**
 * 登录。
 *
 * 刻意不在这里调用 redirect()：跳转交给客户端做一次整页加载。
 * 原因是登录后必须让 Router Cache 里的旧 RSC 负载失效 —— 整页加载最省心也最可靠。
 */
export async function loginAction(password: string): Promise<LoginResult> {
  if (!isAuthConfigured()) {
    return {
      ok: false,
      error:
        "服务端未配置 APP_PASSWORD，无法登录。请在 Vercel 项目设置中添加该环境变量后重新部署。",
    };
  }

  if (!password) return { ok: false, error: "请输入密码" };

  if (!(await verifyPassword(password))) {
    return { ok: false, error: "密码不正确" };
  }

  cookies().set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions());
  return { ok: true };
}

export async function logoutAction(): Promise<{ ok: boolean }> {
  cookies().delete(SESSION_COOKIE);
  return { ok: true };
}
