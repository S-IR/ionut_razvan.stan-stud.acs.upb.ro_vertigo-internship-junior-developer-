//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config";
// eslint.config.js
import { defineConfig, globalIgnores } from "eslint/config";

export default [
  ...tanstackConfig,
  ...defineConfig([
    globalIgnores([".output", "node_modules", "tailwind.config.js", "eslint.config.js"]),
  ]),
];
