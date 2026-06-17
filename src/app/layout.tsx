import type { Metadata } from "next";
import { Bodoni_Moda, Work_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-bodoni",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Prompt Vault",
  description: "个人提示词档案库",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body
        className={`${bodoni.variable} ${workSans.variable} ${jetbrains.variable} bg-glow film-grain`}
      >
        {children}
      </body>
    </html>
  );
}
