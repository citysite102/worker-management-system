import { defineConfig, devices } from "@playwright/test";

/**
 * E2E 測試設定。
 *
 *   pnpm e2e:db:setup   # 建立 wms_e2e 資料庫（schema 變更後才需重跑）
 *   pnpm e2e            # 跑 E2E
 *   pnpm e2e:ui         # 開 Playwright UI 模式除錯
 *
 * E2E 用獨立的 wms_e2e 資料庫，與整合測試的 wms_test 分開，
 * 這樣兩者可以同時跑而不會互相 truncate。
 *
 * 注意：server/_core/index.ts 在 PORT 被占用時會自動往上找下一個 port，
 * 但 Playwright 只等這裡指定的那一個，因此 port 被占用時會直接逾時而不是自動跟上。
 * 選 3199 是因為 3000/3100 這類常見 port 容易被開發 server 或 Docker 容器占走。
 * 需要換 port 時設環境變數 E2E_PORT。
 */
const PORT = Number(process.env.E2E_PORT ?? 3199);
const BASE_URL = `http://localhost:${PORT}`;
const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "mysql://root:root@localhost:3306/wms_e2e";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false, // 共用一個資料庫，避免測試互相干擾
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "zh-TW",
    timezoneId: "Asia/Taipei",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      NODE_ENV: "development",
      PORT: String(PORT),
      DATABASE_URL: E2E_DATABASE_URL,
      // E2E 走本地繞過登入，不依賴 Manus OAuth。
      DEV_AUTH_BYPASS: "1",
      JWT_SECRET:
        process.env.JWT_SECRET ?? "e2e-test-secret-not-for-production",
    },
  },
});
