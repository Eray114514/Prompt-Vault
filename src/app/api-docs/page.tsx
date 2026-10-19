import type { Metadata } from "next";
import { headers } from "next/headers";
import { ApiDocsClient } from "@/components/ApiDocsClient";
import { getModelCatalog } from "@/lib/actions";
import type { ModelCount } from "@/lib/prompts";
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

  /**
   * 文档里直接内联"本库已有模型"，agent 拿到复制文本就不必先调接口枚举。
   * 这里刻意吞掉错误：模型清单只是文档的便利信息，不该因为一次读库失败
   * 把整页 API 文档打成错误页。拿不到就退化成空清单。
   */
  let modelCatalog: ModelCount[] = [];
  try {
    modelCatalog = await getModelCatalog();
  } catch {
    modelCatalog = [];
  }

  return (
    <ApiDocsClient
      baseUrl={baseUrl}
      apiSecret={apiSecret}
      modelCatalog={modelCatalog}
      generatedAt={new Date().toISOString().slice(0, 10)}
    />
  );
}
