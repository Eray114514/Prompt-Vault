import type { Metadata } from "next";
import { headers } from "next/headers";
import { ApiDocsClient } from "@/components/ApiDocsClient";

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

export default function ApiDocsPage() {
  const baseUrl = getBaseUrl();
  return (
    <ApiDocsClient
      baseUrl={baseUrl}
      writeEnabled={Boolean(process.env.API_SECRET)}
    />
  );
}
