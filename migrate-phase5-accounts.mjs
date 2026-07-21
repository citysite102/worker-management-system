import { createConnection } from "mysql2/promise";
import "dotenv/config";

// P0 WS1：多角色帳號 + 稽核日誌。
// 從環境變數取連線字串（本地由 dotenv 載入 .env；Manus 由平台注入，無 .env）。
// 本腳本為 idempotent：每個 ADD COLUMN / CREATE INDEX 先查 information_schema，
// 已存在則略過，可安全重複執行。欄位定義須與 drizzle/schema.ts 逐一對齊。
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

async function hasIndex(table, index) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, index]
  );
  return rows[0].c > 0;
}

async function hasTable(table) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table]
  );
  return rows[0].c > 0;
}

let done = 0;
const run = async (label, sql) => {
  try {
    await conn.execute(sql);
    console.log("✅", label);
    done++;
  } catch (err) {
    console.error("❌", label, "—", err.code ?? err.message);
  }
};

// ── users：新增欄位（對齊 drizzle/schema.ts）──────────────────────────────────
const addColumns = [
  [
    "accountType",
    `ALTER TABLE users ADD COLUMN accountType ENUM('worker','employer','staff') NULL`,
  ],
  ["workerId", `ALTER TABLE users ADD COLUMN workerId INT NULL`],
  ["customerId", `ALTER TABLE users ADD COLUMN customerId INT NULL`],
  ["phone", `ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL`],
  [
    "phoneVerified",
    `ALTER TABLE users ADD COLUMN phoneVerified INT NOT NULL DEFAULT 0`,
  ],
  [
    "preferredLang",
    `ALTER TABLE users ADD COLUMN preferredLang ENUM('zh-TW','vi','id','en') NULL`,
  ],
];
for (const [col, sql] of addColumns) {
  if (await hasColumn("users", col)) {
    console.log("⏭  users.", col, "已存在，略過");
  } else {
    await run(`users ADD COLUMN ${col}`, sql);
  }
}

// ── users.role：加入 'staff'（MODIFY 為 idempotent，重跑結果一致）──────────────
await run(
  "users MODIFY role ENUM(user,admin,staff)",
  `ALTER TABLE users MODIFY COLUMN role ENUM('user','admin','staff') NOT NULL DEFAULT 'user'`
);

// ── users：索引 ───────────────────────────────────────────────────────────────
const userIndexes = [
  [
    "users_accountType_idx",
    `CREATE INDEX users_accountType_idx ON users (accountType)`,
  ],
  ["users_workerId_idx", `CREATE INDEX users_workerId_idx ON users (workerId)`],
  [
    "users_customerId_idx",
    `CREATE INDEX users_customerId_idx ON users (customerId)`,
  ],
];
for (const [name, sql] of userIndexes) {
  if (await hasIndex("users", name)) {
    console.log("⏭  index", name, "已存在，略過");
  } else {
    await run(`CREATE INDEX ${name}`, sql);
  }
}

// ── audit_logs：建表 + 索引 ───────────────────────────────────────────────────
await run(
  "CREATE TABLE audit_logs",
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    actorUserId INT NULL,
    action VARCHAR(80) NOT NULL,
    entityType VARCHAR(50) NULL,
    entityId INT NULL,
    meta TEXT NULL,
    ip VARCHAR(64) NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`
);
if (await hasTable("audit_logs")) {
  const auditIndexes = [
    [
      "audit_logs_actorUserId_idx",
      `CREATE INDEX audit_logs_actorUserId_idx ON audit_logs (actorUserId)`,
    ],
    [
      "audit_logs_entity_idx",
      `CREATE INDEX audit_logs_entity_idx ON audit_logs (entityType, entityId)`,
    ],
    [
      "audit_logs_createdAt_idx",
      `CREATE INDEX audit_logs_createdAt_idx ON audit_logs (createdAt)`,
    ],
  ];
  for (const [name, sql] of auditIndexes) {
    if (await hasIndex("audit_logs", name)) {
      console.log("⏭  index", name, "已存在，略過");
    } else {
      await run(`CREATE INDEX ${name}`, sql);
    }
  }
}

console.log(`\nDone. ${done} statement(s) executed.`);
await conn.end();
