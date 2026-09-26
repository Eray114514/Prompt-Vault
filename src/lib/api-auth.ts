import { constantTimeEqual } from "./auth";

/**
 * 两个 API 路由共用的 Bearer 鉴权。
 *
 * 抽出来是为了避免"两份实现各自漂移" —— 之前 secretMatches 只长在
 * /api/prompts 里，导出端点要是照抄一份，将来改安全策略就会漏掉一处。
 */

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** 先哈希再比：两边长度恒为 64，比较过程不泄露长度或前缀信息。 */
export async function secretMatches(
  provided: string,
  expected: string
): Promise<boolean> {
  const [a, b] = await Promise.all([sha256Hex(provided), sha256Hex(expected)]);
  return constantTimeEqual(a, b);
}

export function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";
}

/** 读取指定环境变量里非空的那几个。调用方负责在结果为空时拒绝服务。 */
export function configuredSecrets(...names: string[]): string[] {
  return names
    .map((name) => (process.env[name] ?? "").trim())
    .filter((value) => value.length > 0);
}

export async function matchesAnySecret(
  provided: string,
  candidates: string[]
): Promise<boolean> {
  if (!provided || candidates.length === 0) return false;
  const results = await Promise.all(
    candidates.map((candidate) => secretMatches(provided, candidate))
  );
  return results.some(Boolean);
}
