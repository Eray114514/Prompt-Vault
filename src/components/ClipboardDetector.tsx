"use client";

import { useState, useEffect, useRef } from "react";
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

export function ClipboardDetector({
  onDetect,
  existingPrompts,
}: ClipboardDetectorProps) {
  const [detected, setDetected] = useState<string | null>(null);
  const checkedRef = useRef(false);
  const existingRef = useRef(existingPrompts);

  useEffect(() => {
    existingRef.current = existingPrompts;
  }, [existingPrompts]);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const checkClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text || !looksLikePrompt(text)) return;
        if (existingRef.current.some((p) => p.content === text.trim())) return;
        setDetected(text);
      } catch {
        // silent
      }
    };

    const timer = setTimeout(checkClipboard, 800);
    return () => clearTimeout(timer);
  }, []);

  if (!detected) return null;

  const preview =
    detected.length > 140 ? detected.slice(0, 140) + "..." : detected;

  return (
    <div className="fixed bottom-8 right-8 z-40 w-80 animate-slide-in-right">
      <div className="glass-strong overflow-hidden rounded-2xl shadow-2xl">
        <div
          className="h-1 w-full"
          style={{
            background:
              "linear-gradient(90deg, #ff6b35, #00d9ff, #ff006e, #caff00)",
          }}
        />
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-accent-glow">
              <ClipboardIcon size={16} className="text-accent" />
              <span className="text-sm font-medium text-text-primary">
                检测到剪贴板内容
              </span>
            </div>
            <button
              onClick={() => setDetected(null)}
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
              onClick={() => {
                onDetect(detected);
                setDetected(null);
              }}
              className="btn flex-1 rounded-lg bg-accent py-2 text-xs font-medium text-white shadow-[0_0_14px_rgba(255,107,53,0.3)] hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(255,107,53,0.45)]"
            >
              添加为提示词
            </button>
            <button
              onClick={() => setDetected(null)}
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
