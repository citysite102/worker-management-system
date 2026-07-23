/**
 * 遷移腳本（idempotent）：開放諮詢入口 + 聯絡偏好（lead-pipeline §8、§4.1）。
 *   - match_requests.targetType enum 增 'general_inquiry'
 *   - 新增 preferredChannel / preferredTime / inquiryCategory / inquiryCity 欄位
 *
 * 部署順序關鍵：先跑本腳本再上程式碼（既有查詢會選取新欄位）。
 * 用法：node -r dotenv/config scripts/migrate-inquiry-pipeline.mjs
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

// 1) targetType enum 增 general_inquiry（ALTER 為冪等：直接設定完整目標 enum）
console.log("→ 擴充 match_requests.targetType enum（+general_inquiry）…");
await conn.execute(
  `ALTER TABLE \`match_requests\`
     MODIFY COLUMN \`targetType\`
     enum('job_posting','case_demand','worker','general_inquiry') NOT NULL`
);
console.log("✓ targetType 已含 general_inquiry");

// 2) 新增欄位（逐一檢查存在性）
const additions = [
  [
    "preferredChannel",
    "ADD COLUMN `preferredChannel` enum('phone','line','whatsapp','zalo','email')",
  ],
  [
    "preferredTime",
    "ADD COLUMN `preferredTime` enum('anytime','daytime','evening','weekend')",
  ],
  [
    "inquiryCategory",
    "ADD COLUMN `inquiryCategory` enum('caregiver','domestic_helper','other','unsure')",
  ],
  ["inquiryCity", "ADD COLUMN `inquiryCity` varchar(20)"],
];

for (const [col, ddl] of additions) {
  if (await columnExists("match_requests", col)) {
    console.log(`· match_requests.${col} 已存在，略過`);
  } else {
    await conn.execute(`ALTER TABLE \`match_requests\` ${ddl}`);
    console.log(`✓ match_requests.${col} 已新增`);
  }
}

console.log("✓ 完成（開放諮詢入口 + 聯絡偏好）");
await conn.end();
