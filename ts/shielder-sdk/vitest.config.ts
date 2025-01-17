import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [],
  test: {
    globals: true,
    coverage: {
      include: ["src/**/*.ts"],
      reporter: ["text", "json"]
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
