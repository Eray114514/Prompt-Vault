/**
 * 会话令牌的生成与校验。
 *
 * 这个模块刻意保持"纯净"：只依赖 Web Crypto 和 process.env，
 * 不 import next/headers 或任何 Node 专有模块 —— 因为 middleware 跑在 Edge runtime，
 * 会直接引用这里。需要读 cookie 的辅助函数放在 `lib/session.ts`。
 */

export const SESSION_COOKIE = "pv_session";

/**
 * 浏览器对 cookie 有效期有硬上限（Chrome 自 M104 起是 400 天，超了会被静默截断到 400 天）。
 * 所以"永久有效"不是靠一个超大的 maxAge 实现的，而是 400 天 + 滑动续期。
 */
export const SESSION_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/** 令牌签发超过这个时长，就在下一次请求时换新 cookie，把 400 天窗口一直往前推。 */
const RENEW_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

const TOKEN_PREFIX = "prompt-vault:session:v1:";

export interface AuthConfig {
  /** 未 trim 的原始值，仅用于判断是否配置 */
  configured: boolean;
  secret: string;
}

export function authConfig(): AuthConfig {
  const rawPassword = process.env.APP_PASSWORD ?? "";
  const password = rawPassword.trim();
  // AUTH_SECRET 独立于密码：设了它，改密码就不会连带让已登录的会话失效。
  const secret = (process.env.AUTH_SECRET ?? "").trim() || password;
  return { configured: password.length > 0, secret };
}

/** 配置齐全时才能登录。缺失时全站 fail-closed —— 宁可不给进，也不能裸奔。 */
export function isAuthConfigured(): boolean {
  return authConfig().configured;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toHex(signature);
}

/** 定长（64 字符 hex）比较，长度分支不影响循环体，可用于机密比对。 */
export function constantTimeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * 密码比对：两边都先过 HMAC 再比，这样既不泄露密码长度，
 * 也避免把明文直接留在比较函数的栈上。
 */
export async function verifyPassword(input: string): Promise<boolean> {
  const { configured, secret } = authConfig();
  if (!configured) return false;
  const [inputDigest, passwordDigest] = await Promise.all([
    hmac(secret, `prompt-vault:password:${input}`),
    hmac(secret, `prompt-vault:password:${(process.env.APP_PASSWORD ?? "").trim()}`),
  ]);
  return constantTimeEqual(inputDigest, passwordDigest);
}

export async function createSessionToken(issuedAt: number = Date.now()): Promise<string> {
  const { secret } = authConfig();
  const signature = await hmac(secret, `${TOKEN_PREFIX}${issuedAt}`);
  return `${issuedAt}.${signature}`;
}

export interface SessionState {
  valid: boolean;
  issuedAt: number;
  /** 令牌够老，建议换发一张新 cookie 以延续有效期 */
  shouldRenew: boolean;
}

const INVALID_SESSION: SessionState = { valid: false, issuedAt: 0, shouldRenew: false };

export async function inspectSession(token?: string | null): Promise<SessionState> {
  const { configured, secret } = authConfig();
  if (!configured || !token) return INVALID_SESSION;

  const separator = token.indexOf(".");
  if (separator <= 0) return INVALID_SESSION;

  const issuedAtRaw = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const issuedAt = Number(issuedAtRaw);

  if (!Number.isSafeInteger(issuedAt) || issuedAt <= 0) return INVALID_SESSION;
  if (issuedAt > Date.now() + 24 * 60 * 60 * 1000) return INVALID_SESSION;

  const expected = await hmac(secret, `${TOKEN_PREFIX}${issuedAtRaw}`);
  if (!constantTimeEqual(signature, expected)) return INVALID_SESSION;

  return {
    valid: true,
    issuedAt,
    shouldRenew: Date.now() - issuedAt > RENEW_AFTER_MS,
  };
}

/** 同时适用于 next/headers 的 cookies() 与 middleware 的 response.cookies。 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
