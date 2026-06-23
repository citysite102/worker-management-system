/**
 * seed-cases.mjs
 * 插入案件假資料（cases + case_qualifications + case_demands + case_assignments + case_assignment_workers + case_employments）
 * 執行：node seed-cases.mjs
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

const conn = await mysql.createConnection(DATABASE_URL);

// ─── 查詢現有移工 & 客戶 & 負責人 ────────────────────────────────────────────
const [workerRows] = await conn.execute(
  "SELECT id, name FROM workers ORDER BY id LIMIT 12"
);
const [customerRows] = await conn.execute(
  "SELECT id, name FROM customers ORDER BY id LIMIT 10"
);
const [managerRows] = await conn.execute(
  "SELECT id, name FROM managers ORDER BY id LIMIT 7"
);

if (workerRows.length === 0 || customerRows.length === 0) {
  console.error("❌ 找不到移工或客戶資料，請先確認 seed 資料已存在");
  await conn.end();
  process.exit(1);
}

console.log(`✅ 找到 ${workerRows.length} 位移工、${customerRows.length} 個客戶、${managerRows.length} 位負責人`);
workerRows.forEach(w => console.log(`  移工 #${w.id}: ${w.name}`));
customerRows.forEach(c => console.log(`  客戶 #${c.id}: ${c.name}`));

// Helper: 取得 ID
const W = (i) => workerRows[i % workerRows.length].id;
const C = (i) => customerRows[i % customerRows.length].id;
const M = (i) => managerRows[i % managerRows.length].id;

// ─── 1. 插入 cases ────────────────────────────────────────────────────────────
const casesData = [
  {
    customerId: C(0), name: "台灣精密科技 - 製造業移工招募 2025", managerId: M(0),
    status: "in_progress",
    notes: "優先招募印尼籍製造業移工，預計 Q3 入境，已完成資格申請。"
  },
  {
    customerId: C(1), name: "新光紡織廠 - 2025 年度補充人力", managerId: M(1),
    status: "in_progress",
    notes: "補充製造業人力 3 名，其中 1 名已確認人選，等待文件辦理。"
  },
  {
    customerId: C(2), name: "大成食品 - 農業移工專案", managerId: M(2),
    status: "paused",
    notes: "客戶暫緩需求，等待農委會配額開放後繼續推進。"
  },
  {
    customerId: C(3), name: "福爾摩沙電子 - 白領工程師引進", managerId: M(3),
    status: "completed",
    notes: "已成功媒合 2 名越南籍工程師，合約已生效。"
  },
  {
    customerId: C(4), name: "中華農業開發 - 農業季節工", managerId: M(4),
    status: "in_progress",
    notes: "季節性農業需求，預計 4 月至 10 月聘僱，共需 5 名。"
  },
  {
    customerId: C(0), name: "台灣精密科技 - 續聘案 2026", managerId: M(0),
    status: "in_progress",
    notes: "現有移工合約到期前 6 個月啟動續聘程序。"
  },
  {
    customerId: C(5), name: "統一超商物流 - 倉儲人力補充", managerId: M(5),
    status: "cancelled",
    notes: "客戶因組織調整取消此次招募計畫。"
  },
];

const caseIds = [];
for (const c of casesData) {
  const [result] = await conn.execute(
    "INSERT INTO cases (customerId, name, managerId, status, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
    [c.customerId, c.name, c.managerId, c.status, c.notes]
  );
  caseIds.push(result.insertId);
  console.log(`  ✅ 案件 #${result.insertId}: ${c.name}`);
}

// ─── 2. 插入 case_qualifications ──────────────────────────────────────────────
const qualIds = [];
const qualsData = [
  // 案件 0（製造業）
  { caseId: caseIds[0], label: "製造業資格一（一般製造）", category: "labor_in", qualType: "manufacturing",
    employerName: "台灣精密科技股份有限公司", employerTaxId: "12345678",
    applicationStatus: "approved", quotaTotal: 5, docValidUntil: "2026-12-31",
    notes: "已核准 5 名製造業移工配額" },
  // 案件 1（製造業）
  { caseId: caseIds[1], label: "製造業資格一（紡織）", category: "labor_in", qualType: "manufacturing",
    employerName: "新光紡織廠股份有限公司", employerTaxId: "87654321",
    applicationStatus: "reviewing", quotaTotal: 3, docValidUntil: "2026-09-30",
    notes: "審核中，預計 2 週內核准" },
  // 案件 2（農業）
  { caseId: caseIds[2], label: "農業資格一（一般農業）", category: "labor_in", qualType: "agriculture",
    employerName: "大成食品工業股份有限公司", employerTaxId: "11223344",
    applicationStatus: "preparing", quotaTotal: 4, docValidUntil: null,
    notes: "等待農委會配額開放" },
  // 案件 3（白領）
  { caseId: caseIds[3], label: "白領資格一（資訊工程）", category: "professional", qualType: "white_collar",
    employerName: "福爾摩沙電子股份有限公司", employerTaxId: "44332211",
    applicationStatus: "approved", quotaTotal: 2, docValidUntil: "2027-03-31",
    notes: "已核准，合約已生效" },
  // 案件 4（農業）
  { caseId: caseIds[4], label: "農業資格一（季節農業）", category: "labor_in", qualType: "agriculture",
    employerName: "中華農業開發股份有限公司", employerTaxId: "55667788",
    applicationStatus: "submitted", quotaTotal: 5, docValidUntil: "2025-10-31",
    notes: "已送件，等待審核" },
  // 案件 5（製造業續聘）
  { caseId: caseIds[5], label: "製造業資格一（續聘）", category: "labor_in", qualType: "manufacturing",
    employerName: "台灣精密科技股份有限公司", employerTaxId: "12345678",
    applicationStatus: "preparing", quotaTotal: 3, docValidUntil: null,
    notes: "續聘程序啟動中" },
];

for (const q of qualsData) {
  const [result] = await conn.execute(
    `INSERT INTO case_qualifications
      (caseId, label, category, qualType, employerName, employerTaxId, applicationStatus, quotaTotal, docValidUntil, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [q.caseId, q.label, q.category, q.qualType, q.employerName || null, q.employerTaxId || null,
     q.applicationStatus, q.quotaTotal, q.docValidUntil || null, q.notes || null]
  );
  qualIds.push(result.insertId);
  console.log(`  ✅ 資格 #${result.insertId}: ${q.label}`);
}

// ─── 3. 插入 case_demands ─────────────────────────────────────────────────────
const demandIds = [];
const demandsData = [
  // 案件 0
  { caseId: caseIds[0], label: "製造業需求一（車床操作）", qualificationId: qualIds[0],
    qualType: "manufacturing", neededCount: 3, status: "filling", notes: "需具備車床操作經驗" },
  { caseId: caseIds[0], label: "製造業需求二（品管）", qualificationId: qualIds[0],
    qualType: "manufacturing", neededCount: 2, status: "open", notes: "品管人員，可接受無經驗" },
  // 案件 1
  { caseId: caseIds[1], label: "紡織需求一（縫紉）", qualificationId: qualIds[1],
    qualType: "manufacturing", neededCount: 2, status: "filling", notes: "需有縫紉機操作經驗" },
  { caseId: caseIds[1], label: "紡織需求二（包裝）", qualificationId: qualIds[1],
    qualType: "manufacturing", neededCount: 1, status: "fulfilled", notes: "包裝作業員，已媒合完成" },
  // 案件 3（已完成）
  { caseId: caseIds[3], label: "工程師需求一（前端）", qualificationId: qualIds[3],
    qualType: "white_collar", neededCount: 1, status: "fulfilled", notes: "Vue.js 前端工程師" },
  { caseId: caseIds[3], label: "工程師需求二（後端）", qualificationId: qualIds[3],
    qualType: "white_collar", neededCount: 1, status: "fulfilled", notes: "Node.js 後端工程師" },
  // 案件 4
  { caseId: caseIds[4], label: "農業需求一（果園採收）", qualificationId: qualIds[4],
    qualType: "agriculture", neededCount: 3, status: "open", notes: "芒果採收季節工" },
  { caseId: caseIds[4], label: "農業需求二（蔬菜種植）", qualificationId: qualIds[4],
    qualType: "agriculture", neededCount: 2, status: "open", notes: "蔬菜種植與管理" },
  // 案件 5
  { caseId: caseIds[5], label: "製造業續聘需求", qualificationId: qualIds[5],
    qualType: "manufacturing", neededCount: 3, status: "open", notes: "現有移工合約到期前續聘" },
];

for (const d of demandsData) {
  const [result] = await conn.execute(
    `INSERT INTO case_demands
      (caseId, label, qualificationId, qualType, neededCount, status, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [d.caseId, d.label, d.qualificationId || null, d.qualType, d.neededCount, d.status, d.notes || null]
  );
  demandIds.push(result.insertId);
  console.log(`  ✅ 需求 #${result.insertId}: ${d.label}`);
}

// ─── 4. 插入 case_assignments（媒合批次）────────────────────────────────────
const assignmentIds = [];
const assignmentsData = [
  { caseId: caseIds[0], label: "第一批媒合（車床）", demandId: demandIds[0], qualificationId: qualIds[0],
    batchNote: "從越南招募 3 名車床操作員", notes: null },
  { caseId: caseIds[1], label: "第一批媒合（縫紉）", demandId: demandIds[2], qualificationId: qualIds[1],
    batchNote: "菲律賓縫紉工人", notes: null },
  { caseId: caseIds[3], label: "白領工程師媒合", demandId: demandIds[4], qualificationId: qualIds[3],
    batchNote: "越南工程師 2 名，已完成媒合", notes: "合約已生效" },
  { caseId: caseIds[4], label: "農業季節工媒合", demandId: demandIds[6], qualificationId: qualIds[4],
    batchNote: "泰國農業工人 3 名", notes: null },
  { caseId: caseIds[5], label: "續聘媒合批次", demandId: demandIds[8], qualificationId: qualIds[5],
    batchNote: "現有移工續聘評估", notes: null },
];

for (const a of assignmentsData) {
  const [result] = await conn.execute(
    `INSERT INTO case_assignments
      (caseId, label, demandId, qualificationId, batchNote, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [a.caseId, a.label, a.demandId || null, a.qualificationId || null, a.batchNote || null, a.notes || null]
  );
  assignmentIds.push(result.insertId);
  console.log(`  ✅ 媒合批次 #${result.insertId}: ${a.label}`);
}

// ─── 5. 插入 case_assignment_workers（媒合成員）──────────────────────────────
const assignmentWorkersData = [
  // 案件 0 批次 0：3 名移工
  { assignmentId: assignmentIds[0], caseId: caseIds[0], workerId: W(0), stage: "confirmed",
    matchNote: "已確認，等待文件辦理", expectedDocDate: "2025-08-15", expectedEntryDate: "2025-09-01" },
  { assignmentId: assignmentIds[0], caseId: caseIds[0], workerId: W(1), stage: "candidate",
    matchNote: "評估中，需確認體檢結果", expectedDocDate: null, expectedEntryDate: null },
  { assignmentId: assignmentIds[0], caseId: caseIds[0], workerId: W(2), stage: "candidate",
    matchNote: "備選人員", expectedDocDate: null, expectedEntryDate: null },
  // 案件 1 批次 1：2 名移工
  { assignmentId: assignmentIds[1], caseId: caseIds[1], workerId: W(3), stage: "employed",
    matchNote: "已入職，表現良好", expectedDocDate: "2025-05-01", expectedEntryDate: "2025-06-01" },
  { assignmentId: assignmentIds[1], caseId: caseIds[1], workerId: W(4), stage: "confirmed",
    matchNote: "確認入職，等待入境", expectedDocDate: "2025-07-01", expectedEntryDate: "2025-08-01" },
  // 案件 3 批次 2（已完成）
  { assignmentId: assignmentIds[2], caseId: caseIds[3], workerId: W(5), stage: "employed",
    matchNote: "前端工程師，已在職", expectedDocDate: "2025-01-15", expectedEntryDate: "2025-02-01" },
  { assignmentId: assignmentIds[2], caseId: caseIds[3], workerId: W(6), stage: "employed",
    matchNote: "後端工程師，已在職", expectedDocDate: "2025-01-15", expectedEntryDate: "2025-02-01" },
  // 案件 4 批次 3
  { assignmentId: assignmentIds[3], caseId: caseIds[4], workerId: W(7), stage: "upcoming",
    matchNote: "即將入境，文件已備妥", expectedDocDate: "2025-03-20", expectedEntryDate: "2025-04-01" },
  { assignmentId: assignmentIds[3], caseId: caseIds[4], workerId: W(8), stage: "candidate",
    matchNote: "備選", expectedDocDate: null, expectedEntryDate: null },
  // 案件 5 批次 4（續聘）
  { assignmentId: assignmentIds[4], caseId: caseIds[5], workerId: W(0), stage: "candidate",
    matchNote: "評估是否續聘", expectedDocDate: null, expectedEntryDate: null },
  { assignmentId: assignmentIds[4], caseId: caseIds[5], workerId: W(2), stage: "candidate",
    matchNote: "評估是否續聘", expectedDocDate: null, expectedEntryDate: null },
];

for (const aw of assignmentWorkersData) {
  await conn.execute(
    `INSERT INTO case_assignment_workers
      (assignmentId, caseId, workerId, stage, matchNote, expectedDocDate, expectedEntryDate, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [aw.assignmentId, aw.caseId, aw.workerId, aw.stage, aw.matchNote || null,
     aw.expectedDocDate || null, aw.expectedEntryDate || null]
  );
}
console.log(`  ✅ 插入 ${assignmentWorkersData.length} 筆媒合成員`);

// ─── 6. 插入 case_employments（正式聘僱）────────────────────────────────────
const employmentsData = [
  // 案件 1：已在職
  { caseId: caseIds[1], workerId: W(3), qualificationId: qualIds[1],
    position: "縫紉操作員", contractStart: "2025-06-01", contractEnd: "2028-05-31",
    status: "active", notes: "合約 3 年，表現良好" },
  // 案件 3（已完成）：2 名工程師
  { caseId: caseIds[3], workerId: W(5), qualificationId: qualIds[3],
    position: "前端工程師", contractStart: "2025-02-01", contractEnd: "2027-01-31",
    status: "active", notes: "白領工程師，合約 2 年" },
  { caseId: caseIds[3], workerId: W(6), qualificationId: qualIds[3],
    position: "後端工程師", contractStart: "2025-02-01", contractEnd: "2027-01-31",
    status: "active", notes: "白領工程師，合約 2 年" },
];

for (const e of employmentsData) {
  await conn.execute(
    `INSERT INTO case_employments
      (caseId, workerId, qualificationId, position, contractStart, contractEnd, status, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [e.caseId, e.workerId, e.qualificationId || null, e.position || null,
     e.contractStart || null, e.contractEnd || null, e.status, e.notes || null]
  );
}
console.log(`  ✅ 插入 ${employmentsData.length} 筆正式聘僱`);

await conn.end();
console.log("\n🎉 案件假資料插入完成！");
console.log(`   - ${casesData.length} 個案件`);
console.log(`   - ${qualsData.length} 筆資格`);
console.log(`   - ${demandsData.length} 筆需求`);
console.log(`   - ${assignmentsData.length} 個媒合批次`);
console.log(`   - ${assignmentWorkersData.length} 筆媒合成員`);
console.log(`   - ${employmentsData.length} 筆正式聘僱`);
