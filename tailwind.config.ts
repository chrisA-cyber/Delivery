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
        ink: "var(--ink)",
        paper: "var(--paper)",
        acid: "var(--acid)",
        hot: "var(--hot)",
        electric: "var(--electric)",
        violet: "var(--violet)",
      },
      fontFamily: {
        display: ["Arial Black", "Haettenschweiler", "Impact", "sans-serif"],
        sans: ["Inter", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"],
      },
      boxShadow: {
        acid: "0 0 0 1px rgba(201,255,52,.35), 0 18px 80px rgba(201,255,52,.16)",
        hot: "0 0 0 1px rgba(255,70,199,.4), 0 18px 80px rgba(255,70,199,.18)",
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
