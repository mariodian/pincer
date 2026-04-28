import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    plugins: { "unused-imports": unusedImports },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // @TODO: Move shadcn components to its own folders instead
    ignores: ["src/mainview/lib/components/ui/**"],
  },
];
