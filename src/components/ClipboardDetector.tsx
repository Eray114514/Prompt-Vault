"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Prompt } from "@/lib/types";
import { ClipboardIcon, CloseIcon } from "./Icons";

interface ClipboardDetectorProps {
  onDetect: (content: string) => void;
  existingPrompts: Prompt[];
}

function looksLikePrompt(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 30) return false;
  if (trimmed.length > 5000) return false;
  const lines = trimmed.split("\n").filter(Boolean);
  if (lines.length >= 2) return true;
  const keywords =
    /generate|create|draw|paint|render|prompt|style|detailed|cinematic|4k|8k|photorealistic|描述|生成|绘制|风格|细节|画面|角色|场景|镜头/i;
  if (keywords.test(trimmed)) return true;
  return false;
}

/** 两次剪贴板读取之间的最小间隔，避免每次窗口聚焦都去敲权限。 */
const RECHECK_THROTTLE_MS = 8000;

export function ClipboardDetector({
  onDetect,
  existingPrompts,
}: ClipboardDetectorProps) {
  const [detected, setDetected] = useState<string | null>(null);

  // 用 Set 做 O(1) 命中；旧实现是每次 .some() 全量比字符串
  const existingContentsRef = useRef<Set<string>>(new Set());
  const dismissedRef = useRef<Set<string>>(new Set());
  const lastCheckRef = useRef(0);
  const unsupportedRef = useRef(false);

  const existingContents = useMemo(
    () => new Set(existingPrompts.map((p) => p.content.trim())),
    [existingPrompts]
  );

  useEffect(() => {
    existingContentsRef.current = existingContents;
  }, [existingContents]);

  const checkClipboard = useCallback(async () => {
    if (unsupportedRef.current) return;
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
      // 浏览器没实现（部分非 Chrome 内核）就彻底安静，不要反复打扰
      unsupportedRef.current = true;
      return;
    }
    if (document.visibilityState !== "visible") return;

    const now = Date.now();
    if (now - lastCheckRef.current < RECHECK_THROTTLE_MS) return;
    lastCheckRef.current = now;

    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text?.trim();
      if (!trimmed || !looksLikePrompt(trimmed)) return;
      if (existingContentsRef.current.has(trimmed)) return;
      if (dismissedRef.current.has(trimmed)) return;
      setDetected(trimmed);
    } catch {
      // NotAllowedError 属于常态（页面未聚焦、用户未授权），静默即可
    }
  }, []);

  useEffect(() => {
    // 旧实现只在挂载时查一次，之后复制的东西永远发现不了。
    // 现在改为"首次延迟探测 + 每次回到页面再查"，并用节流控频。
    const initialTimer = setTimeout(() => void checkClipboard(), 800);

    const onFocus = () => void checkClipboard();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkClipboard();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearTimeout(initialTimer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [checkClipboard]);

  const dismiss = useCallback(() => {
    setDetected((current) => {
      if (current) dismissedRef.current.add(current);
      return null;
    });
  }, []);

  if (!detected) return null;

  const preview = detected.length > 140 ? detected.slice(0, 140) + "..." : detected;

  return (
    <div className="animate-slide-in-right fixed bottom-6 right-4 z-40 w-[min(20rem,calc(100vw-2rem))] sm:bottom-8 sm:right-8">
      <div className="glass-strong overflow-hidden rounded-2xl shadow-2xl">
        <div
          className="h-1 w-full"
          style={{
            background: "linear-gradient(90deg, #ff6b35, #00d9ff, #ff006e, #caff00)",
          }}
        />
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardIcon size={16} className="text-accent" />
              <span className="text-sm font-medium text-text-primary">
                检测到剪贴板内容
              </span>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="忽略剪贴板内容"
              className="rounded-md p-1 text-text-muted transition hover:bg-bg-hover hover:text-text-primary"
            >
              <CloseIcon size={14} />
            </button>
          </div>

          <p className="scrollbar-thin mb-4 max-h-24 overflow-y-auto rounded-lg border border-border-subtle/60 bg-bg-base/70 p-3 font-mono text-xs leading-relaxed text-text-secondary">
            {preview}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onDetect(detected);
                dismissedRef.current.add(detected);
                setDetected(null);
              }}
              className="btn flex-1 rounded-lg bg-accent py-2 text-xs font-medium text-white shadow-[0_0_14px_rgba(255,107,53,0.3)] hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(255,107,53,0.45)]"
            >
              添加为提示词
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="btn rounded-lg border border-border-subtle px-4 py-2 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              忽略
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
