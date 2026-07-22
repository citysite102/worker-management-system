/**
 * 遷移腳本（idempotent）：worker_public_profiles 加
 *   - photoKey    varchar(300)  真實照片（登入後才下傳；公開層用匿名頭像）
 *   - ratingAvg   int NOT NULL DEFAULT 0   平均分 ×10（47 = 4.7 星）
 *   - ratingCount int NOT NULL DEFAULT 0   評分則數（≥5 才對外顯示）
 *
 * MySQL 不支援 ADD COLUMN IF NOT EXISTS，故先查 information_schema。
 * 用法：node -r dotenv/config scripts/migrate-profile-rating-photo.mjs
 */
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function columnExists(table, column) {
  const [rows] = await conn.execute(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}
async function addColumn(table, column, ddl) {
  if (await columnExists(table, column)) {
    console.log(`  · ${table}.${column} 已存在，略過`);
    return;
  }
  await conn.execute(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
  console.log(`  ✓ ${table}.${column} 已新增`);
}

console.log("→ 補欄位 worker_public_profiles …");
await addColumn(
  "worker_public_profiles",
  "photoKey",
  "`photoKey` varchar(300)"
);
await addColumn(
  "worker_public_profiles",
  "ratingAvg",
  "`ratingAvg` int NOT NULL DEFAULT 0"
);
await addColumn(
  "worker_public_profiles",
  "ratingCount",
  "`ratingCount` int NOT NULL DEFAULT 0"
);
console.log("✓ 完成");
await conn.end();
