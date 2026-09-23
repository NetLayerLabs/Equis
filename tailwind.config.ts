import type { Config } from "tailwindcss";

/*
 * Equis design tokens: vault ink, brass rule-work, one signal green and one alarm red.
 * Every colour in the app comes from here — don't reach for Tailwind's default palette.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07080A",
        "ink-deep": "#040507",
        panel: "#0F1216",
        "panel-soft": "#151A21",
        line: "#1F2631",
        "line-strong": "#303A49",
        text: "#ECEEF2",
        muted: "#9AA3B2",
        faint: "#6A7382",
        brass: "#C9A227",
        "brass-bright": "#E3BE4A",
        signal: "#3FB68B",
        alarm: "#E5574A",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "0.875rem",
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.5), 0 12px 32px -16px rgb(0 0 0 / 0.8)",
        lift: "0 2px 6px rgb(0 0 0 / 0.5), 0 28px 60px -24px rgb(0 0 0 / 0.9)",
      },
      animation: {
        rise: "rise 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "pulse-dot": "pulse-dot 1.8s ease-in-out infinite",
      },
      keyframes: {
        rise: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.82)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
