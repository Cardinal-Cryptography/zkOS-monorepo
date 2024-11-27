import * as path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import envCompatible from "vite-plugin-env-compatible";
import { env } from "./validate-envs";

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

const mapEnvVariables = (envObject) => {
  const envVariables = {};
  Object.keys(envObject).forEach((key) => {
    envVariables[`process.env.${key}`] = JSON.stringify(envObject[key]);
  });

  return envVariables;
};

export default defineConfig(({ mode }) => {
  return {
    envPrefix: "PLASMO_PUBLIC_",
    define: {
      ...mapEnvVariables(env),
    },
    plugins: [envCompatible(), react(), tsconfigPaths(), setCors()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      }
    },
    server: {
      fs: {
        allow: ["../shielder-sdk", "../../crates/shielder-wasm/pkg", "."]
      }
    }
  };
});
