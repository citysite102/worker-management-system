/**
 * 整合測試的 setup file，在每個測試檔載入前執行。
 *
 * 關鍵：在任何程式碼呼叫 `getDb()` 之前，把 `DATABASE_URL` 指向測試資料庫，
 * 確保整合測試絕不會碰到開發用的 wms。
 */
import { afterAll, beforeAll, beforeEach } from "vitest";
import {
  assertTestDbReady,
  closeDb,
  resetDb,
  TEST_DATABASE_URL,
} from "./helpers/testDb";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = "test";
// 讓 context.ts 的繞過機制在測試中提供一個 admin 使用者。
process.env.DEV_AUTH_BYPASS = "1";

beforeAll(async () => {
  await assertTestDbReady();
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDb();
});
