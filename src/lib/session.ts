import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, inspectSession, type SessionState } from "./auth";

/** 读当前请求的会话状态。只在 Server Component / Server Action 里调用。 */
export async function getSession(): Promise<SessionState> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return inspectSession(token);
}

/**
 * 所有写操作的入口守卫。
 *
 * middleware 已经挡了一层，但那只是路由级过滤 —— Server Action 是可以被直接构造 POST
 * 调用的，所以每个 mutation 自己再验一次。
 *
 * 失效时直接 redirect 而不是抛异常：Next.js 在生产环境会把 Server Action 抛出的错误
 * 信息替换成通用文案，靠 message 判断"未授权"在线上是认不出来的。
 */
export async function requireSession(): Promise<void> {
  const session = await getSession();
  if (!session.valid) redirect("/login");
}
