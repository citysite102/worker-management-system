import { createConnection } from "mysql2/promise";
import "dotenv/config";

// 將內部團隊帳號升為 staff 角色。
// ⚠️ 權限硬化（WS3）之前務必先跑這支，否則團隊會被自己的權限鎖在門外。
//
// 用法（以 email 或 openId 指定，可多個）：
//   node scripts/promote-staff.mjs email=a@x.com email=b@y.com
//   node scripts/promote-staff.mjs openId=abc123
//   node scripts/promote-staff.mjs list          # 只列出目前 users 與角色，不修改
//
// owner（ENV.ownerOpenId）本來就是 admin，不需在此處理。

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL 未設定");
  process.exit(1);
}

const args = process.argv.slice(2);
const conn = await createConnection(dbUrl);

if (args.length === 0 || args.includes("list")) {
  const [rows] = await conn.execute(
    `SELECT id, openId, name, email, role, accountType FROM users ORDER BY id`
  );
  console.log("目前使用者：");
  for (const r of rows) {
    console.log(
      `  #${r.id}  ${r.role.padEnd(6)}  ${r.email ?? "—"}  (${r.name ?? "—"}) openId=${r.openId}`
    );
  }
  if (args.length === 0) {
    console.log(
      "\n未指定升級對象。用法：node scripts/promote-staff.mjs email=a@x.com [openId=...]"
    );
  }
  await conn.end();
  process.exit(0);
}

const emails = args.filter(a => a.startsWith("email=")).map(a => a.slice(6));
const openIds = args.filter(a => a.startsWith("openId=")).map(a => a.slice(7));

let promoted = 0;
async function promote(where, param, label) {
  const [res] = await conn.execute(
    `UPDATE users SET role = 'staff' WHERE ${where} AND role <> 'admin'`,
    [param]
  );
  if (res.affectedRows > 0) {
    console.log(`✅ 升為 staff：${label}`);
    promoted += res.affectedRows;
    // 稽核：角色變更（audit_logs 已於 WS1 建立）
    try {
      const [rows] = await conn.execute(`SELECT id FROM users WHERE ${where}`, [
        param,
      ]);
      for (const r of rows) {
        await conn.execute(
          `INSERT INTO audit_logs (actorUserId, action, entityType, entityId, meta)
           VALUES (NULL, 'user.role_change', 'users', ?, ?)`,
          [r.id, JSON.stringify({ to: "staff", via: "promote-staff-cli" })]
        );
      }
    } catch (err) {
      // audit_logs 尚未建立（migration 未跑）時不擋主流程
      console.warn("  （稽核寫入略過：", err.code ?? err.message, "）");
    }
  } else {
    console.log(`⏭  未變更（找不到、已是 admin，或已是 staff）：${label}`);
  }
}

for (const email of emails) await promote("email = ?", email, `email=${email}`);
for (const openId of openIds)
  await promote("openId = ?", openId, `openId=${openId}`);

console.log(`\nDone. ${promoted} 位使用者升為 staff。`);
await conn.end();
