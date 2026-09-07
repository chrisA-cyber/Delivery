import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        paper: "rgb(var(--paper-rgb) / <alpha-value>)",
        acid: "rgb(var(--acid-rgb) / <alpha-value>)",
        hot: "rgb(var(--hot-rgb) / <alpha-value>)",
        electric: "rgb(var(--electric-rgb) / <alpha-value>)",
        violet: "rgb(var(--violet-rgb) / <alpha-value>)",
      },
      fontFamily: {
        display: ["Barlow Condensed", "Impact", "Arial Narrow", "sans-serif"],
        sans: ["DM Sans", "Segoe UI", "Arial", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"],
      },
      boxShadow: {
        acid: "0 8px 28px rgba(255,220,102,.15)",
        hot: "0 8px 28px rgba(255,76,200,.15)",
      },
      animation: {
        marquee: "marquee 28s linear infinite",
        float: "float 5s ease-in-out infinite",
        pulseRing: "pulseRing 1.8s ease-out infinite",
        scan: "scan 3.5s linear infinite",
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(-2deg)" },
          "50%": { transform: "translateY(-10px) rotate(2deg)" },
        },
        pulseRing: {
          "0%": { transform: "scale(.86)", opacity: "0.75" },
          "100%": { transform: "scale(1.35)", opacity: "0" },
        },
        scan: {
          from: { transform: "translateY(-120%)" },
          to: { transform: "translateY(680%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
