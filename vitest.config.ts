import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

/**
 * 單元測試設定：不碰資料庫，`server/db.ts` 一律被 mock 掉。
 * 整合測試另見 vitest.integration.config.ts。
 */
export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["server/**/*.ts", "shared/**/*.ts"],
      exclude: [
        "server/**/*.test.ts",
        "server/__tests__/**",
        "server/_core/**",
      ],
    },
  },
});
