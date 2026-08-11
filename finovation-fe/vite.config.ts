import { loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")

  const host = env.VITE_DEV_HOST || "0.0.0.0"
  const port = Number(env.VITE_DEV_PORT || 5173)
  const strictPort = env.VITE_DEV_STRICT_PORT === "true"
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || "http://localhost:8080"

  return {
    plugins: [react()],

    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },

    server: {
      host,
      port,
      strictPort,
      clearScreen: false,

      watch: {
        ignored: [
          "**/finovation-docs/reference/**",
          "**/coverage/**",
          "**/dist/**",
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

    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      clearMocks: true,
      restoreMocks: true,
      maxWorkers: 2,
      testTimeout: 20_000,
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/main.tsx", "src/test/**", "src/vite-env.d.ts"],
        thresholds: {
          statements: 60,
          branches: 55,
          functions: 55,
          lines: 60,
        },
      },
    },
  }
})
