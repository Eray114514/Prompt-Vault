import { headers } from "next/headers";
import { ApiDocsClient } from "@/components/ApiDocsClient";

export const dynamic = "force-dynamic";

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
  return <ApiDocsClient baseUrl={baseUrl} />;
}
