import type { Metadata } from "next";
import { headers } from "next/headers";
import { ApiDocsClient } from "@/components/ApiDocsClient";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "API 文档 · Prompt Vault",
  robots: { index: false, follow: false, nocache: true },
};

function getBaseUrl() {
  const headersList = headers();
  const host = headersList.get("host") || "localhost:3000";
  const proto =
    headersList.get("x-forwarded-proto") ||
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function ApiDocsPage() {
  /**
   * 这一页会把 API_SECRET 明文序列化给客户端，所以自己再验一次会话 ——
   * 不能只依赖 middleware 的 matcher（改一次 matcher 就可能漏掉一条路径）。
   * 未登录时 requireSession 直接 redirect("/login")，secret 不会被渲染。
   */
  await requireSession();

  const baseUrl = getBaseUrl();
  const apiSecret = (process.env.API_SECRET ?? "").trim() || null;

  return <ApiDocsClient baseUrl={baseUrl} apiSecret={apiSecret} />;
}
