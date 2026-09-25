"use client";

import { AlertIcon, CheckIcon, CloseIcon, UndoIcon } from "./Icons";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: number;
  text: string;
  type: "success" | "error";
  action?: ToastAction;
}

interface ToastStackProps {
  messages: ToastMessage[];
  onDismiss: (id: number) => void;
}

/**
 * 提示条改成队列。
 *
 * 旧实现只存一条 message，连续操作时后一条会把前一条挤掉 —— 比如"删除 → 撤销"这套
 * 交互根本没机会把撤销按钮露出来。
 */
export function ToastStack({ messages, onDismiss }: ToastStackProps) {
  if (messages.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
      role="region"
      aria-label="操作提示"
    >
      {messages.map((message) => {
        const isError = message.type === "error";
        return (
          <div
            key={message.id}
            role="status"
            aria-live="polite"
            className={`glass-strong animate-slide-up pointer-events-auto flex max-w-md items-center gap-3 rounded-full border py-2 pl-4 pr-2 shadow-2xl ${
              isError ? "border-red-500/25" : "border-emerald-500/25"
            }`}
          >
            <span
              className={`shrink-0 ${isError ? "text-red-400" : "text-emerald-400"}`}
            >
              {isError ? <AlertIcon size={15} /> : <CheckIcon size={15} />}
            </span>
            <span className="text-sm font-medium text-text-primary">
              {message.text}
            </span>

            {message.action && (
              <button
                type="button"
                onClick={message.action.onClick}
                className="btn ml-1 shrink-0 rounded-full bg-bg-elevated px-3 py-1 text-xs text-text-primary transition hover:bg-bg-hover"
              >
                <UndoIcon size={13} />
                {message.action.label}
              </button>
            )}

            <button
              type="button"
              onClick={() => onDismiss(message.id)}
              aria-label="关闭提示"
              className="shrink-0 rounded-full p-1.5 text-text-muted transition hover:bg-bg-hover hover:text-text-primary"
            >
              <CloseIcon size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
