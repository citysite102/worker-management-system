import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

/**
 * 前端測試設定：jsdom + Testing Library。
 *
 *   pnpm test:client
 *
 * 與 server 測試分開是必要的 —— server 測試跑在 node 環境，前端要 jsdom，
 * 兩者的 environment 不同，混在同一個 config 會互相打架。
 */
export default defineConfig({
  // vitest 2.x 內含的是 vite 5 的型別，而本專案用 vite 7，兩者的 Plugin 型別
  // 結構相同但來源不同，TypeScript 會判定不相容。這個 cast 只是繞過版本落差，
  // 不影響執行期行為 —— 等 vitest 升到與 vite 7 相容的版本後即可移除。
  plugins: [react()] as never,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["client/src/**/*.test.tsx", "client/src/**/*.test.ts"],
    setupFiles: ["client/src/__tests__/setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage/client",
      include: ["client/src/**/*.{ts,tsx}"],
      exclude: [
        "client/src/**/*.test.{ts,tsx}",
        "client/src/__tests__/**",
        "client/src/components/ui/**", // shadcn 產生的元件，不是我們維護的
        "client/src/_core/**",
      ],
    },
  },
});
