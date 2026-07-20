/**
 * Playwright global setup：在整批 E2E 開跑前，把 wms_e2e 重置並灌入假資料。
 *
 * 用既有的 seed-mock-data.mjs 產生資料，確保 E2E 看到的畫面與開發時一致。
 * seed 腳本讀 process.env.DATABASE_URL；dotenv 預設不覆寫已存在的環境變數，
 * 所以這裡傳進去的 E2E 連線字串會蓋過 .env 裡的開發連線字串。
 */
import { execFileSync } from "node:child_process";

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "mysql://root:root@localhost:3306/wms_e2e";

export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL };

  console.log(`[e2e] 重建資料庫 ${E2E_DATABASE_URL}`);
  execFileSync("node", ["scripts/setup-test-db.mjs"], {
    stdio: "inherit",
    env: { ...env, TEST_DATABASE_URL: E2E_DATABASE_URL },
  });

  console.log("[e2e] 灌入假資料 ...");
  execFileSync("node", ["seed-mock-data.mjs"], { stdio: "inherit", env });

  console.log("[e2e] 資料準備完成");
}
