import * as path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function crossOriginIsolationMiddleware(_, res, next) {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
}

const setCors = () => ({
  name: "configure-server",
  configureServer: (server) => {
    server.middlewares.use(crossOriginIsolationMiddleware);
  },
  configurePreviewServer: (server) => {
    server.middlewares.use(crossOriginIsolationMiddleware);
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), setCors()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  optimizeDeps: {
    exclude: ["@cardinal-cryptography/shielder-sdk-crypto-wasm"]
  }
});
