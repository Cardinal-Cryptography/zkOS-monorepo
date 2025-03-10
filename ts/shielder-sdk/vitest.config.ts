import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [],
  test: {
    globals: true,
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/_generated/**"],
      reporter: ["text", "json-summary"]
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
