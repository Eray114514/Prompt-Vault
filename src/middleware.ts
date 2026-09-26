import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  inspectSession,
  sessionCookieOptions,
} from "@/lib/auth";

/**
 * 前端整站需要登录才能访问。
 *
 * 明确放行的例外：
 * - `/api/prompts` —— 刻意保持公开，供云端 agent 无密钥读取（见 route.ts 的说明）
 * - `/api/export`  —— 整库导出。**同样必须放行**，否则带 Bearer 的 cron / 本机 curl
 *   不带会话 cookie，会被这里的 307 挡在 handler 外面。它的安全性完全由自身的
 *   503/401 承担（两个 secret 都没配就拒绝服务）。
 * - `/login`       —— 登录页本身，也是登录 Server Action 的提交目标
 * - `/robots.txt`  —— 爬虫得读得到这份"全站别收录"的声明
 * - `_next/*`、图标等静态资源
 */
export async function middleware(request: NextRequest) {
  const session = await inspectSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (session.valid) {
    const response = NextResponse.next();
    // 滑动续期：浏览器把 cookie 有效期硬截在 400 天，所以定期换发新 cookie，
    // 只要还在用就永远不会掉登录。
    if (session.shouldRenew) {
      response.cookies.set(
        SESSION_COOKIE,
        await createSessionToken(),
        sessionCookieOptions()
      );
    }
    return response;
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";

  const response = NextResponse.redirect(loginUrl);
  if (request.cookies.has(SESSION_COOKIE)) {
    response.cookies.delete(SESSION_COOKIE);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api/prompts|api/export|_next/static|_next/image|login|favicon.ico|icon.svg|robots.txt).*)",
  ],
};
