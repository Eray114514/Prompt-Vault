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
        cat: {
          image: "var(--cat-image-gen)",
          edit: "var(--cat-image-edit)",
          video: "var(--cat-video)",
          llm: "var(--cat-llm)",
        },
      },
      fontFamily: {
        display: ["var(--font-bodoni)", "Georgia", "serif"],
        body: ["var(--font-work)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.25s ease-out",
        "slide-up": "slideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        "scale-in": "scaleIn 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-in-right": "slideInRight 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
        "card-enter": "cardEnter 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "flash": "flashCopy 0.5s ease-out",
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
        cardEnter: {
          "0%": { opacity: "0", transform: "translateY(16px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        flashCopy: {
          "0%": { boxShadow: "0 0 0 0 rgba(255, 214, 0, 0.5)" },
          "100%": { boxShadow: "0 0 0 12px rgba(255, 214, 0, 0)" },
        },
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        glow: "0 0 24px var(--accent-glow)",
      },
    },
  },
  plugins: [],
};

export default config;
