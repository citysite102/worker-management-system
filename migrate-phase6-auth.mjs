import { createConnection } from "mysql2/promise";
import "dotenv/config";

// P0 WS2：Email/密碼登入所需欄位（users.passwordHash）。
// idempotent：欄位已存在則略過，可安全重複執行（含 Manus）。
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL 未設定");
  process.exit(1);
}

const conn = await createConnection(dbUrl);

async function hasColumn(table, column) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  return rows[0].c > 0;
}

if (await hasColumn("users", "passwordHash")) {
  console.log("⏭  users.passwordHash 已存在，略過");
} else {
  await conn.execute(
    `ALTER TABLE users ADD COLUMN passwordHash VARCHAR(255) NULL`
  );
  console.log("✅ users ADD COLUMN passwordHash");
}

console.log("Done.");
await conn.end();
