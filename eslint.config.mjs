import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", ".next-dev/**", "next-env.d.ts", "node_modules/**", "coverage/**", "playwright-report/**"],
  },
];

export default config;
