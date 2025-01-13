import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    ignores: [
      "**/dist/",
      "**/dist-vite/",
      "**/src/_generated/",
      "eslint.config.mjs",
      "**/update-imports.mjs",
      "**/jest.config.ts",
      "**/__tests/"
    ]
  },
  {
    rules: {
      "@typescript-eslint/unbound-method": [
        "error",
        {
          ignoreStatic: true
        }
      ],
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": "allow-with-description",
          "ts-nocheck": "allow-with-description",
          "ts-check": "allow-with-description"
        }
      ]
    }
  }
);
