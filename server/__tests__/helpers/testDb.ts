/**
 * 整合測試的資料庫工具。
 *
 * 與單元測試不同，整合測試 **不 mock `server/db.ts`**，而是讓它真的打到
 * 一個獨立的 MySQL database（wms_test），藉此驗證 SQL、drizzle schema、
 * 索引與交易行為是否正確 —— 這些是 mock 測試永遠測不到的。
 *
 * 先跑 `pnpm test:db:setup` 建立資料庫，再跑 `pnpm test:integration`。
 */
import mysql from "mysql2/promise";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "mysql://root:root@localhost:3306/wms_test";

/**
 * 依 FK 依賴由子到父排列。實際 truncate 時會暫時關掉 FK 檢查，
 * 但維持這個順序可讓失敗訊息比較好讀。
 */
const TABLES = [
  "kpi_snapshots",
  "worker_experiences",
  "worker_public_profiles",
  "match_requests",
  "moderation_events",
  "job_postings",
  "case_assignment_workers",
  "case_assignments",
  "case_employments",
  "case_demands",
  "case_qualifications",
  "cases",
  "customer_qualifications",
  "customer_care_receivers",
  "customers",
  "workers",
  "managers",
  "users",
] as const;

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({ uri: TEST_DATABASE_URL, connectionLimit: 5 });
  }
  return pool;
}

/** 清空所有資料表。每個 test 前呼叫，確保測試之間互不汙染。 */
export async function resetDb(): Promise<void> {
  const conn = await getPool().getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of TABLES) {
      await conn.query(`TRUNCATE TABLE \`${table}\``);
    }
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    conn.release();
  }
}

/** 給測試直接下 SQL 用（驗證寫入結果、或塞不經 API 的前置資料）。 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const [rows] = await getPool().query(sql, params);
  return rows as T[];
}

/** 確認測試資料庫存在且 schema 已套用；沒有就給出可執行的修復指示。 */
export async function assertTestDbReady(): Promise<void> {
  try {
    await query("SELECT 1 FROM `cases` LIMIT 1");
  } catch (error) {
    throw new Error(
      `無法連上測試資料庫（${TEST_DATABASE_URL}）或 schema 尚未建立。\n` +
        `請先執行：\n` +
        `  docker start wms-mysql\n` +
        `  pnpm test:db:setup\n\n` +
        `原始錯誤：${(error as Error).message}`
    );
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
