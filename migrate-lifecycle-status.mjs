/**
 * migrate-lifecycle-status.mjs
 * 將 workers.lifecycleStatus 由舊列舉值遷移到新列舉值，並安全變更欄位型別。
 *
 * 舊 → 新 對應：
 *   recruiting / 招募中          → preparing_abroad（準備來台）
 *   document_processing / 文件辦理 → preparing_abroad（準備來台）
 *   employed / 在職              → employed（在職中）
 *   pending_renewal / 待續聘      → idle_in_tw（待業中-在台灣）
 *   departed / 已離境            → returned（已回國）
 *
 * 流程（避免 enum 直接 ALTER 造成舊值失效）：
 *   1. 將欄位暫時改為 VARCHAR
 *   2. UPDATE 舊值 → 新值
 *   3. 將欄位改為新 enum
 *
 * ⚠️ 對正式資料庫執行前請先備份。可重複執行（已是新值者不受影響）。
 * 執行：DATABASE_URL=... node migrate-lifecycle-status.mjs
 */

import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL 未設定");
  process.exit(1);
}

const conn = await mysql.createConnection({ uri: DATABASE_URL, multipleStatements: true });

console.log("1) 將 lifecycleStatus 暫改為 VARCHAR …");
await conn.query("ALTER TABLE workers MODIFY lifecycleStatus VARCHAR(30) NOT NULL");

console.log("2) 對應舊值 → 新值 …");
const [res] = await conn.query(`
  UPDATE workers SET lifecycleStatus = CASE lifecycleStatus
    WHEN 'recruiting'          THEN 'preparing_abroad'
    WHEN 'document_processing' THEN 'preparing_abroad'
    WHEN 'employed'            THEN 'employed'
    WHEN 'pending_renewal'     THEN 'idle_in_tw'
    WHEN 'departed'            THEN 'returned'
    ELSE lifecycleStatus
  END
`);
console.log(`   已更新 ${res.affectedRows} 筆`);

// 保險：任何不在新列舉內的殘值，一律歸到 preparing_abroad
await conn.query(`
  UPDATE workers SET lifecycleStatus = 'preparing_abroad'
  WHERE lifecycleStatus NOT IN ('employed','idle_in_tw','preparing_abroad','returned','absconded')
`);

console.log("3) 將 lifecycleStatus 改為新 enum …");
await conn.query(
  "ALTER TABLE workers MODIFY lifecycleStatus " +
  "ENUM('employed','idle_in_tw','preparing_abroad','returned','absconded') NOT NULL"
);

const [rows] = await conn.query(
  "SELECT lifecycleStatus, COUNT(*) AS n FROM workers GROUP BY lifecycleStatus"
);
console.log("✅ 遷移完成，目前分布：");
for (const r of rows) console.log(`   ${r.lifecycleStatus}: ${r.n}`);

await conn.end();
