import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "var(--bg-base)",
          surface: "var(--bg-surface)",
          elevated: "var(--bg-elevated)",
          hover: "var(--bg-hover)",
          input: "var(--bg-input)",
        },
        border: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border-default)",
          hover: "var(--border-hover)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          glow: "var(--accent-glow)",
          soft: "var(--accent-soft)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        fav: {
          DEFAULT: "var(--fav)",
          soft: "var(--fav-soft)",
        },
        // 原 cat.* 映射已移除：它映射的 --cat-* 变量此前只被登录页一处渐变消费，
        // 那处已删，分类色的唯一事实来源现在是 types.ts 的 CATEGORY_COLORS。
      },
      fontFamily: {
        display: ["var(--font-bodoni)", "Georgia", "serif"],
        body: ["var(--font-work)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      // 这里只保留真正被 className 使用的动画。
      // card-enter 与 flash 的 keyframes 曾在 globals.css 里各有一份重复定义，
      // 同名的 @keyframes 会互相覆盖、行为不可控 —— 已删掉这边的重复份。
      animation: {
        "fade-in": "fadeIn 0.25s ease-out",
        "slide-up": "slideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        "scale-in": "scaleIn 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-in-right": "slideInRight 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        glow: "0 0 20px var(--accent-glow)",
      },
    },
  },
  plugins: [],
};

export default config;
