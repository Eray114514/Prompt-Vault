"use client";

import { CheckIcon, CloseIcon } from "./Icons";

export interface ToastMessage {
  id: number;
  text: string;
  type: "success" | "error";
}

interface ToastProps {
  message: ToastMessage;
}

export function Toast({ message }: ToastProps) {
  const isError = message.type === "error";

  return (
    <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 animate-slide-up">
      <div
        className={`glass-strong flex items-center gap-2.5 rounded-full border px-4 py-2.5 shadow-2xl ${
          isError
            ? "border-red-500/20 text-red-400"
            : "border-emerald-500/20 text-emerald-400"
        }`}
      >
        {isError ? <CloseIcon size={15} /> : <CheckIcon size={15} />}
        <span className="text-sm font-medium text-text-primary">
          {message.text}
        </span>
      </div>
    </div>
  );
}
