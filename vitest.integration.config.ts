import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

/**
 * 整合測試設定：打真實的 MySQL（wms_test），驗證 SQL / schema / 索引。
 *
 *   pnpm test:db:setup      # 建立或重置測試資料庫（只需在 schema 變更後跑）
 *   pnpm test:integration
 *
 * 單執行緒（singleFork）是刻意的：所有測試共用同一個 database，
 * 每個 test 前會 TRUNCATE 全表，平行執行會互相清掉對方的資料。
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
    include: ["server/**/*.integration.test.ts"],
    setupFiles: ["server/__tests__/setup.integration.ts"],
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
