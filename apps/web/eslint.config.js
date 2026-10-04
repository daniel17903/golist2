import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "comma-dangle": ["error", "always-multiline"],
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "no-nested-ternary": "warn",
      "object-shorthand": ["error", "always"],
      "prefer-template": "warn",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" },
      ],
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Playwright E2E suite: runs in Node, and Playwright fixtures use `use`
    // and `{}` destructuring, which the React rules misread.
    files: ["e2e/**/*.ts", "playwright.config.ts"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "no-empty-pattern": "off",
    },
  },
);
