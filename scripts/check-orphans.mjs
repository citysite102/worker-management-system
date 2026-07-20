#!/usr/bin/env node
/**
 * 掃描資料庫中的孤兒列（子表指向已不存在的父列）。
 *
 *   node scripts/check-orphans.mjs                    # 掃 DATABASE_URL
 *   DATABASE_URL=... node scripts/check-orphans.mjs   # 掃指定資料庫
 *   node scripts/check-orphans.mjs --delete           # 清掉找到的孤兒列
 *
 * 為什麼需要這支：schema 目前完全沒有 FK 約束，資料完整性全靠應用層自律。
 * 要補上 FK 之前必須先確認沒有孤兒列，否則 ALTER TABLE 會直接失敗。
 */
import mysql from "mysql2/promise";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL 未設定");
  process.exit(1);
}

const DELETE = process.argv.includes("--delete");

/** [子表, 子表欄位, 父表, 父表欄位] */
const RELATIONS = [
  ["cases", "customerId", "customers", "id"],
  ["cases", "managerId", "managers", "id"],
  ["workers", "managerId", "managers", "id"],
  ["customers", "managerId", "managers", "id"],
  ["customer_care_receivers", "customerId", "customers", "id"],
  ["customer_qualifications", "customerId", "customers", "id"],
  ["case_qualifications", "caseId", "cases", "id"],
  ["case_demands", "caseId", "cases", "id"],
  ["case_assignments", "caseId", "cases", "id"],
  ["case_assignment_workers", "assignmentId", "case_assignments", "id"],
  ["case_assignment_workers", "caseId", "cases", "id"],
  ["case_assignment_workers", "workerId", "workers", "id"],
  ["case_employments", "caseId", "cases", "id"],
  ["case_employments", "workerId", "workers", "id"],
];

const conn = await mysql.createConnection({ uri: DATABASE_URL });
const url = new URL(DATABASE_URL);
console.log(`[orphans] 掃描 ${url.pathname.slice(1)} ...\n`);

let total = 0;
for (const [childTable, childCol, parentTable, parentCol] of RELATIONS) {
  const where =
    `c.\`${childCol}\` IS NOT NULL ` +
    `AND NOT EXISTS (SELECT 1 FROM \`${parentTable}\` p WHERE p.\`${parentCol}\` = c.\`${childCol}\`)`;

  let rows;
  try {
    [rows] = await conn.query(
      `SELECT COUNT(*) AS n FROM \`${childTable}\` c WHERE ${where}`
    );
  } catch (error) {
    console.log(`  ⚠ ${childTable}.${childCol} 跳過：${error.message}`);
    continue;
  }

  const n = Number(rows[0].n);
  if (n === 0) continue;

  total += n;
  console.log(
    `  ✖ ${childTable}.${childCol} → ${parentTable}.${parentCol}：${n} 筆孤兒`
  );

  if (DELETE) {
    await conn.query(`DELETE c FROM \`${childTable}\` c WHERE ${where}`);
    console.log(`    ↳ 已刪除`);
  }
}

await conn.end();

if (total === 0) {
  console.log("✓ 沒有孤兒資料，可以安全加上 FK 約束");
  process.exit(0);
}

console.log(`\n共 ${total} 筆孤兒資料。`);
if (!DELETE) {
  console.log("加上 --delete 可清除（請先確認這些資料真的不需要）。");
  process.exit(1);
}
