import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")

  const host = env.VITE_DEV_HOST || "0.0.0.0"
  const port = Number(env.VITE_DEV_PORT || 5173)
  const strictPort = env.VITE_DEV_STRICT_PORT === "true"
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || "http://backend:8080"

  return {
    plugins: [react()],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    server: {
      host,
      port,
      strictPort,
      clearScreen: false,

      watch: {
        ignored: [
          "**/src/assets/reference/**",
          "**/.DS_Store",
          "**/node_modules/**",
          "**/.env.local",
        ],
      },

      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
