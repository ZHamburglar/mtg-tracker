import globals from "globals";
import js from "@eslint/js";

const eslintConfig = [
  {
    ignores: [
      "node_modules/",
      ".next/",
      "out/",
      "build/",
      "dist/",
      "*.log",
      ".env*.local",
      ".vercel",
      ".DS_Store",
      "coverage/"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        React: "readonly"
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      // Disable rules that are too strict for this project
      "no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      
      // Enforce consistent code style
      "prefer-const": "warn",
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "eqeqeq": ["error", "always"],
      "curly": ["error", "all"],
      
      // Disable some rules that conflict with React/Next.js
      "no-undef": "off"  // React is globally available in Next.js
    }
  }
];

export default eslintConfig;
