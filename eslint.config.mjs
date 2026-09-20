/**
 * @file eslint.config.mjs
 * @description Flat ESLint configuration for Next.js 16 with TypeScript and Core Web Vitals rules.
 * Excludes build caches, node_modules, and Python virtual environment folders.
 */

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".venv/**",
    "venv/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
