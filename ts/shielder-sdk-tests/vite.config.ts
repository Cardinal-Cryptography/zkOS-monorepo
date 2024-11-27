import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

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
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    envPrefix: "PLASMO_PUBLIC_",
    define: {
      "process.env.PLASMO_PUBLIC_THREADS": JSON.stringify(
        env.PLASMO_PUBLIC_THREADS,
      ),
    },
    root: "web",
    build: {
      outDir: "../dist",
      emptyOutDir: true,
    },
    plugins: [react(), tsconfigPaths(), setCors()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./web"),
      },
    },
    server: {
      fs: {
        allow: ["../../shielder-sdk", "../../../crates/shielder-wasm/pkg", "."],
      },
    },
  };
});
