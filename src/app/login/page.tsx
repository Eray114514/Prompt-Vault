import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { SESSION_COOKIE, inspectSession, isAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "登录 · Prompt Vault",
  robots: { index: false, follow: false, nocache: true },
};

export default async function LoginPage() {
  const session = await inspectSession(cookies().get(SESSION_COOKIE)?.value);
  if (session.valid) redirect("/");

  return <LoginForm serverConfigured={isAuthConfigured()} />;
}
