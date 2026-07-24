import { createConnection } from "mysql2/promise";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import "dotenv/config";

// 建立測試用 email/密碼帳號（worker / employer / staff）。
// 密碼雜湊格式與 server/_core/auth/password.ts 一致（scrypt$salt$hash）。
// idempotent：email 已存在則更新角色/密碼，否則新建。
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL 未設定");
  process.exit(1);
}

const scryptAsync = promisify(scrypt);
async function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(pw, salt, 64);
  return `scrypt$${salt}$${buf.toString("hex")}`;
}

const PASSWORD = "test1234";
const accounts = [
  {
    email: "worker@test.local",
    name: "測試移工",
    role: "user",
    accountType: "worker",
  },
  {
    email: "employer@test.local",
    name: "測試雇主",
    role: "user",
    accountType: "employer",
  },
  {
    email: "staff@test.local",
    name: "測試員工",
    role: "staff",
    accountType: null,
  },
];

const conn = await createConnection(dbUrl);

for (const a of accounts) {
  const passwordHash = await hashPassword(PASSWORD);
  const [rows] = await conn.execute(
    `SELECT id FROM users WHERE email = ? LIMIT 1`,
    [a.email]
  );
  if (rows.length > 0) {
    await conn.execute(
      `UPDATE users SET role = ?, accountType = ?, passwordHash = ?, loginMethod = 'email', emailVerified = 1, name = ? WHERE id = ?`,
      [a.role, a.accountType, passwordHash, a.name, rows[0].id]
    );
    console.log(
      `♻️  更新：${a.email}（${a.role}${a.accountType ? "/" + a.accountType : ""}）`
    );
  } else {
    const openId = `local_seed_${a.accountType ?? a.role}`;
    await conn.execute(
      `INSERT INTO users (openId, email, name, loginMethod, role, accountType, passwordHash, emailVerified, lastSignedIn)
       VALUES (?, ?, ?, 'email', ?, ?, ?, 1, NOW())`,
      [openId, a.email, a.name, a.role, a.accountType, passwordHash]
    );
    console.log(
      `✅ 新建：${a.email}（${a.role}${a.accountType ? "/" + a.accountType : ""}）`
    );
  }
}

console.log(`\n完成。密碼一律：${PASSWORD}`);
await conn.end();
