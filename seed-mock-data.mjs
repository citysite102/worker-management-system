/**
 * seed-mock-data.mjs
 * 產生一整套本地開發用模擬資料，欄位 / enum / 格式皆對齊 drizzle/schema.ts。
 *
 * 涵蓋：
 *   managers / workers / customers / customer_care_receivers / customer_qualifications
 *   cases / case_qualifications / case_demands / case_assignments
 *   case_assignment_workers / case_employments
 *
 * 特性：執行前會先清空上述資料表，因此可重複執行（idempotent）。
 * 執行：node seed-mock-data.mjs
 *
 * ⚠️ 僅供本地開發。會清空資料，請勿對正式資料庫執行。
 */

import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL 未設定（請確認 .env）");
  process.exit(1);
}

const conn = await mysql.createConnection({ uri: DATABASE_URL, multipleStatements: true });

// ─── 0. 清空資料表（子表 → 父表順序，雖無 DB 層 FK 仍照順序）─────────────────
console.log("🧹 清空既有資料...");
const tablesToClear = [
  "case_employments",
  "case_assignment_workers",
  "case_assignments",
  "case_demands",
  "case_qualifications",
  "cases",
  "customer_qualifications",
  "customer_care_receivers",
  "customers",
  "workers",
  "managers",
];
await conn.query("SET FOREIGN_KEY_CHECKS = 0");
for (const t of tablesToClear) {
  await conn.query(`DELETE FROM \`${t}\``);
  await conn.query(`ALTER TABLE \`${t}\` AUTO_INCREMENT = 1`);
}
await conn.query("SET FOREIGN_KEY_CHECKS = 1");

// ─── 1. Managers（負責人）─────────────────────────────────────────────────────
const managerNames = ["陳怡君", "林志明", "黃淑芬", "張家豪", "李美玲", "王建國", "吳雅婷"];
const managerIds = [];
for (const name of managerNames) {
  const [r] = await conn.execute(
    "INSERT INTO managers (name, createdAt) VALUES (?, NOW())",
    [name]
  );
  managerIds.push(r.insertId);
}
const M = (i) => managerIds[i % managerIds.length];
console.log(`✅ 負責人 ${managerIds.length} 位`);

// ─── 2. Workers（移工）────────────────────────────────────────────────────────
// nationality 採文件範例格式「NNN 國名」
const workersData = [
  { nameEn: "SUPARMAN", nameCn: "蘇巴曼", name: "蘇巴曼 SUPARMAN", birthDate: "1990-03-12", gender: "male",
    nationality: "印尼", birthPlace: "印尼", occupation: "manufacturing",
    lifecycleStatus: "employed", documentStatus: "complete",
    residentPermitNo: "AD30912345", residentPermitExpiry: "2027-08-31",
    passportNo: "C1234567", passportExpiry: "2029-05-20", entryDate: "2024-09-01",
    phone: "0912345678", email: "suparman@example.com",
    lastMedicalExamDate: "2025-03-01", nextMedicalExamType: "annual", notes: "車床操作經驗 3 年" },
  { nameEn: "NGUYEN VAN AN", nameCn: null, name: "NGUYEN VAN AN", birthDate: "1992-07-22", gender: "male",
    nationality: "越南", birthPlace: "越南", occupation: "manufacturing",
    lifecycleStatus: "preparing_abroad", documentStatus: "pending_supplement",
    residentPermitNo: "AD30912346", residentPermitExpiry: "2027-06-30",
    passportNo: "B7654321", passportExpiry: "2028-11-15", entryDate: "2025-01-10",
    phone: "0912345679", email: null,
    lastMedicalExamDate: "2025-01-05", nextMedicalExamType: "6_month", notes: null },
  { nameEn: "WAYAN SUDANA", nameCn: null, name: "WAYAN SUDANA", birthDate: "1988-11-03", gender: "male",
    nationality: "印尼", birthPlace: "印尼", occupation: "manufacturing",
    lifecycleStatus: "preparing_abroad", documentStatus: "not_started",
    residentPermitNo: null, residentPermitExpiry: null,
    passportNo: "C2233445", passportExpiry: "2030-02-28", entryDate: null,
    phone: null, email: null,
    lastMedicalExamDate: null, nextMedicalExamType: "pre_entry", notes: "備選人員" },
  { nameEn: "MARIA SANTOS", nameCn: null, name: "MARIA SANTOS", birthDate: "1995-05-18", gender: "female",
    nationality: "菲律賓", birthPlace: "菲律賓", occupation: "manufacturing",
    lifecycleStatus: "employed", documentStatus: "complete",
    residentPermitNo: "AD30912347", residentPermitExpiry: "2028-05-31",
    passportNo: "P1122334", passportExpiry: "2029-08-10", entryDate: "2024-06-01",
    phone: "0922333444", email: "maria.santos@example.com",
    lastMedicalExamDate: "2024-12-01", nextMedicalExamType: "annual", notes: "縫紉作業熟練" },
  { nameEn: "DELA CRUZ JOSE", nameCn: null, name: "DELA CRUZ JOSE", birthDate: "1993-09-09", gender: "male",
    nationality: "菲律賓", birthPlace: "菲律賓", occupation: "manufacturing",
    lifecycleStatus: "idle_in_tw", documentStatus: "expiring_soon",
    residentPermitNo: "AD30912348", residentPermitExpiry: "2026-07-25",
    passportNo: "P5566778", passportExpiry: "2027-04-22", entryDate: "2025-03-01",
    phone: "0922333555", email: null,
    lastMedicalExamDate: "2025-02-20", nextMedicalExamType: "6_month", notes: "居留證即將到期，需辦理展延" },
  { nameEn: "TRAN THI HOA", nameCn: null, name: "TRAN THI HOA", birthDate: "1991-02-14", gender: "female",
    nationality: "越南", birthPlace: "越南", occupation: "other",
    lifecycleStatus: "employed", documentStatus: "complete",
    residentPermitNo: "AD30912349", residentPermitExpiry: "2027-01-31",
    passportNo: "B9988776", passportExpiry: "2028-12-01", entryDate: "2025-02-01",
    phone: "0933444555", email: "tranhoa@example.com",
    lastMedicalExamDate: "2025-01-15", nextMedicalExamType: "annual", notes: "前端工程師（白領）" },
  { nameEn: "LE MINH QUAN", nameCn: null, name: "LE MINH QUAN", birthDate: "1989-12-25", gender: "male",
    nationality: "越南", birthPlace: "越南", occupation: "other",
    lifecycleStatus: "employed", documentStatus: "complete",
    residentPermitNo: "AD30912350", residentPermitExpiry: "2027-01-31",
    passportNo: "B4455667", passportExpiry: "2029-03-18", entryDate: "2025-02-01",
    phone: "0933444666", email: "lequan@example.com",
    lastMedicalExamDate: "2025-01-15", nextMedicalExamType: "annual", notes: "後端工程師（白領）" },
  { nameEn: "SOMCHAI PROMMA", nameCn: null, name: "SOMCHAI PROMMA", birthDate: "1994-08-30", gender: "male",
    nationality: "泰國", birthPlace: "泰國", occupation: "agriculture",
    lifecycleStatus: "preparing_abroad", documentStatus: "pending_supplement",
    residentPermitNo: "AD30912351", residentPermitExpiry: "2026-05-15",
    passportNo: "AA1234567", passportExpiry: "2028-07-07", entryDate: "2025-03-25",
    phone: "0955666777", email: null,
    lastMedicalExamDate: "2025-03-10", nextMedicalExamType: "6_month", notes: "果園採收" },
  { nameEn: "BUDI SANTOSO", nameCn: null, name: "BUDI SANTOSO", birthDate: "1996-01-20", gender: "male",
    nationality: "印尼", birthPlace: "印尼", occupation: "agriculture",
    lifecycleStatus: "preparing_abroad", documentStatus: "not_started",
    residentPermitNo: null, residentPermitExpiry: null,
    passportNo: "C7788990", passportExpiry: "2030-06-15", entryDate: null,
    phone: null, email: null,
    lastMedicalExamDate: null, nextMedicalExamType: "pre_entry", notes: "農業備選人員" },
  { nameEn: "SITI RAHAYU", nameCn: null, name: "SITI RAHAYU", birthDate: "1990-10-05", gender: "female",
    nationality: "印尼", birthPlace: "印尼", occupation: "caregiver_family",
    lifecycleStatus: "employed", documentStatus: "complete",
    residentPermitNo: "AD30912352", residentPermitExpiry: "2027-09-30",
    passportNo: "C3344556", passportExpiry: "2029-09-09", entryDate: "2024-10-01",
    phone: "0966777888", email: null,
    lastMedicalExamDate: "2025-04-01", nextMedicalExamType: "annual", notes: "家庭看護，照顧長者經驗豐富" },
  { nameEn: "AUNG MYAT", nameCn: null, name: "AUNG MYAT", birthDate: "1993-04-17", gender: "male",
    nationality: "緬甸", birthPlace: "緬甸", occupation: "fishery",
    lifecycleStatus: "idle_in_tw", documentStatus: "expiring_soon",
    residentPermitNo: "AD30912353", residentPermitExpiry: "2026-08-12",
    passportNo: "MA1239876", passportExpiry: "2027-02-02", entryDate: "2022-07-01",
    phone: "0977888999", email: null,
    lastMedicalExamDate: "2024-07-01", nextMedicalExamType: "annual", notes: "漁業，合約到期待續聘" },
  { nameEn: "DEWI LESTARI", nameCn: null, name: "DEWI LESTARI", birthDate: "1997-06-28", gender: "female",
    nationality: "印尼", birthPlace: "印尼", occupation: "caregiver_hospital",
    lifecycleStatus: "returned", documentStatus: "complete",
    residentPermitNo: "AD30912354", residentPermitExpiry: "2024-12-31",
    passportNo: "C9900112", passportExpiry: "2026-10-30", entryDate: "2021-12-01",
    phone: null, email: null,
    lastMedicalExamDate: "2024-06-01", nextMedicalExamType: "other", notes: "已離境，合約期滿返國" },
];

const workerIds = [];
for (let i = 0; i < workersData.length; i++) {
  const w = workersData[i];
  const [r] = await conn.execute(
    `INSERT INTO workers
      (workerNo, nameEn, nameCn, name, birthDate, gender, nationality, birthPlace, occupation,
       lifecycleStatus, documentStatus, managerId,
       residentPermitNo, residentPermitExpiry, passportNo, passportExpiry, entryDate,
       phone, email, lastMedicalExamDate, nextMedicalExamType, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [`W-${String(i + 1).padStart(5, "0")}`, w.nameEn, w.nameCn, w.name, w.birthDate, w.gender, w.nationality, w.birthPlace, w.occupation,
     w.lifecycleStatus, w.documentStatus, M(i),
     w.residentPermitNo, w.residentPermitExpiry, w.passportNo, w.passportExpiry, w.entryDate,
     w.phone, w.email, w.lastMedicalExamDate, w.nextMedicalExamType, w.notes]
  );
  workerIds.push(r.insertId);
}
const W = (i) => workerIds[i % workerIds.length];
console.log(`✅ 移工 ${workerIds.length} 位`);

// ─── 3. Customers（雇主：6 公司 + 4 個人）─────────────────────────────────────
const companyCustomers = [
  { name: "台灣精密科技股份有限公司", taxId: "12345678", industry: "電子製造業",
    contactName: "陳經理", contactPhone: "0233445566", contractStatus: "in_service", pricingTier: "standard" },
  { name: "新光紡織廠股份有限公司", taxId: "87654321", industry: "紡織業",
    contactName: "林主任", contactPhone: "0233445567", contractStatus: "signed", pricingTier: "standard" },
  { name: "大成食品工業股份有限公司", taxId: "11223344", industry: "食品製造業",
    contactName: "黃課長", contactPhone: "0233445568", contractStatus: "negotiating", pricingTier: "custom" },
  { name: "福爾摩沙電子股份有限公司", taxId: "44332211", industry: "資訊電子業",
    contactName: "張副理", contactPhone: "0233445569", contractStatus: "in_service", pricingTier: "custom" },
  { name: "中華農業開發股份有限公司", taxId: "55667788", industry: "農業",
    contactName: "李專員", contactPhone: "0233445570", contractStatus: "signed", pricingTier: "standard" },
  { name: "統一超商物流股份有限公司", taxId: "22446688", industry: "物流倉儲業",
    contactName: "王組長", contactPhone: "0233445571", contractStatus: "ended", pricingTier: "standard" },
];

const individualCustomers = [
  { name: "王國華", idNo: "A123456789", phone: "0911222333", contractStatus: "in_service", pricingTier: "standard",
    address: "台北市大安區和平東路一段100號", referrer: "里長介紹",
    careReceiver: { no: "CR001", name: "王林秀英", birth: "1945-02-10", idNo: "A223456788",
      addr: "台北市大安區和平東路一段100號", qualification: "巴氏量表 30 分", relation: "母親" } },
  { name: "林淑芬", idNo: "B223456788", phone: "0911222444", contractStatus: "signed", pricingTier: "standard",
    address: "新北市板橋區文化路二段50號", referrer: null,
    careReceiver: { no: "CR002", name: "林正雄", birth: "1940-08-22", idNo: "B123456787",
      addr: "新北市板橋區文化路二段50號", qualification: "重度身心障礙證明", relation: "父親" } },
  { name: "張志強", idNo: "F126543219", phone: "0911222555", contractStatus: "negotiating", pricingTier: "standard",
    address: "台中市西屯區台灣大道三段200號", referrer: "親友推薦",
    careReceiver: { no: "CR003", name: "張陳美玉", birth: "1938-12-01", idNo: "F226543218",
      addr: "台中市西屯區台灣大道三段200號", qualification: "巴氏量表 28 分", relation: "祖母" } },
  { name: "李美惠", idNo: "E287654321", phone: "0911222666", contractStatus: "pending_renewal", pricingTier: "standard",
    address: "高雄市苓雅區四維三路10號", referrer: null,
    careReceiver: { no: "CR004", name: "李文彬", birth: "1942-06-15", idNo: "E187654322",
      addr: "高雄市苓雅區四維三路10號", qualification: "特定身心障礙重度", relation: "配偶" } },
];

const customerIds = [];

// 3a. 公司雇主
for (let i = 0; i < companyCustomers.length; i++) {
  const c = companyCustomers[i];
  const [r] = await conn.execute(
    `INSERT INTO customers
      (employerType, name, employerNo, phone, address, registeredAddress,
       taxId, industry, contactName, contactPhone,
       contractStatus, pricingTier, managerId, notes, createdAt, updatedAt)
     VALUES ('company', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [c.name, String(33 + i).padStart(5, "0"), c.contactPhone,
     `${c.industry}廠區`, `${c.industry}登記地址`,
     c.taxId, c.industry, c.contactName, c.contactPhone,
     c.contractStatus, c.pricingTier, M(i), `${c.industry}雇主`]
  );
  customerIds.push(r.insertId);
}

// 3b. 個人雇主（家庭看護）
const careReceiverIds = []; // 對應 individualCustomers 順序
for (let i = 0; i < individualCustomers.length; i++) {
  const c = individualCustomers[i];
  const [r] = await conn.execute(
    `INSERT INTO customers
      (employerType, name, employerNo, phone, address, registeredAddress,
       idNo, preCourseNo, referrer,
       careReceiverNo, careReceiverName, careReceiverBirthDate, careReceiverIdNo,
       careReceiverAddress, careReceiverQualification, careReceiverRelation,
       contractStatus, pricingTier, managerId, notes, createdAt, updatedAt)
     VALUES ('individual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [c.name, String(33 + companyCustomers.length + i).padStart(5, "0"), c.phone,
     c.address, c.address,
     c.idNo, `PC${String(1000 + i)}`, c.referrer,
     c.careReceiver.no, c.careReceiver.name, c.careReceiver.birth, c.careReceiver.idNo,
     c.careReceiver.addr, c.careReceiver.qualification, c.careReceiver.relation,
     c.contractStatus, c.pricingTier, M(i), "個人雇主（家庭看護）"]
  );
  const customerId = r.insertId;
  customerIds.push(customerId);

  // 對應子表 customer_care_receivers
  const [cr] = await conn.execute(
    `INSERT INTO customer_care_receivers
      (customerId, careReceiverNo, careReceiverName, careReceiverBirthDate, careReceiverIdNo,
       careReceiverAddress, careReceiverQualification, careReceiverRelation, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [customerId, c.careReceiver.no, c.careReceiver.name, c.careReceiver.birth, c.careReceiver.idNo,
     c.careReceiver.addr, c.careReceiver.qualification, c.careReceiver.relation, null]
  );
  careReceiverIds.push(cr.insertId);
}
const C = (i) => customerIds[i % customerIds.length];
console.log(`✅ 雇主 ${customerIds.length} 個（公司 ${companyCustomers.length}、個人 ${individualCustomers.length}）`);
console.log(`✅ 被照顧者 ${careReceiverIds.length} 位`);

// ─── 4. Customer Qualifications（客戶申請資格）────────────────────────────────
// 4a. 家庭類（family）：連結個人雇主與被照顧者
const companyCount = companyCustomers.length;
for (let i = 0; i < individualCustomers.length; i++) {
  const c = individualCustomers[i];
  const customerId = customerIds[companyCount + i];
  await conn.execute(
    `INSERT INTO customer_qualifications
      (customerId, qualifierCategory, careReceiverId, label, caseStatus, managerId,
       jobSeekerType, jobSeekerDate, recruitmentLetterType, employmentLetterType,
       notes, createdAt, updatedAt)
     VALUES (?, 'family', ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [customerId, careReceiverIds[i], `${c.careReceiver.name} 家庭看護申請`, "processing", M(i),
     "new_hire", "2025-03-01", "overseas", "initial", "家庭看護工申請資格"]
  );
}
// 4b. 事業類（business）：連結公司雇主
const businessQualData = [
  { ci: 0, label: "製造業聘僱資格", jobSeekerType: "new_hire", caseStatus: "matched" },
  { ci: 1, label: "紡織業補充人力資格", jobSeekerType: "new_hire", caseStatus: "processing" },
  { ci: 3, label: "白領工程師引進資格", jobSeekerType: "new_hire", caseStatus: "completed" },
  { ci: 4, label: "農業季節工資格", jobSeekerType: "new_hire", caseStatus: "processing" },
];
for (let i = 0; i < businessQualData.length; i++) {
  const b = businessQualData[i];
  await conn.execute(
    `INSERT INTO customer_qualifications
      (customerId, qualifierCategory, label, caseStatus, managerId,
       jobSeekerType, jobSeekerDate, recruitmentLetterType, employmentLetterType,
       notes, createdAt, updatedAt)
     VALUES (?, 'business', ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [customerIds[b.ci], b.label, b.caseStatus, M(b.ci),
     b.jobSeekerType, "2025-02-15", "both", "initial", "事業類雇主申請資格"]
  );
}
console.log(`✅ 客戶資格 ${individualCustomers.length + businessQualData.length} 筆（家庭 ${individualCustomers.length}、事業 ${businessQualData.length}）`);

// ─── 5. Cases（案件，沿用既有 seed-cases.mjs 結構）────────────────────────────
// caseNo 格式對齊 app 自動產生規則：GVC25-YYYYMMDD-NNN（routers.ts）
const casesData = [
  { customerId: C(0), name: "台灣精密科技 - 製造業移工招募 2025", managerId: M(0), caseNo: "GVC25-20250115-001",
    status: "in_progress", notes: "優先招募印尼籍製造業移工，預計 Q3 入境，已完成資格申請。" },
  { customerId: C(1), name: "新光紡織廠 - 2025 年度補充人力", managerId: M(1), caseNo: "GVC25-20250203-001",
    status: "in_progress", notes: "補充製造業人力 3 名，其中 1 名已確認人選，等待文件辦理。" },
  { customerId: C(2), name: "大成食品 - 農業移工專案", managerId: M(2), caseNo: "GVC25-20250218-001",
    status: "paused", notes: "客戶暫緩需求，等待農委會配額開放後繼續推進。" },
  { customerId: C(3), name: "福爾摩沙電子 - 白領工程師引進", managerId: M(3), caseNo: "GVC25-20250108-001",
    status: "completed", notes: "已成功媒合 2 名越南籍工程師，合約已生效。" },
  { customerId: C(4), name: "中華農業開發 - 農業季節工", managerId: M(4), caseNo: "GVC25-20250310-001",
    status: "in_progress", notes: "季節性農業需求，預計 4 月至 10 月聘僱，共需 5 名。" },
  { customerId: C(0), name: "台灣精密科技 - 續聘案 2026", managerId: M(0), caseNo: "GVC25-20250115-002",
    status: "in_progress", notes: "現有移工合約到期前 6 個月啟動續聘程序。" },
  { customerId: C(5), name: "統一超商物流 - 倉儲人力補充", managerId: M(5), caseNo: "GVC25-20250122-001",
    status: "cancelled", notes: "客戶因組織調整取消此次招募計畫。" },
  { customerId: C(6), name: "王國華 - 家庭看護聘僱案", managerId: M(0), caseNo: "GVC25-20250905-001",
    status: "in_progress", notes: "個人雇主家庭看護，照顧母親，已完成聘前講習。" },
];
const caseIds = [];
for (const c of casesData) {
  const [r] = await conn.execute(
    "INSERT INTO cases (customerId, name, caseNo, managerId, status, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())",
    [c.customerId, c.name, c.caseNo, c.managerId, c.status, c.notes]
  );
  caseIds.push(r.insertId);
}
console.log(`✅ 案件 ${caseIds.length} 個`);

// 5a. case_qualifications
const qualIds = [];
const qualsData = [
  { caseId: caseIds[0], label: "製造業資格一（一般製造）", category: "labor_in", qualType: "manufacturing",
    employerName: "台灣精密科技股份有限公司", employerTaxId: "12345678",
    applicationStatus: "approved", quotaTotal: 5, docValidUntil: "2026-12-31", notes: "已核准 5 名製造業移工配額" },
  { caseId: caseIds[1], label: "製造業資格一（紡織）", category: "labor_in", qualType: "manufacturing",
    employerName: "新光紡織廠股份有限公司", employerTaxId: "87654321",
    applicationStatus: "reviewing", quotaTotal: 3, docValidUntil: "2026-09-30", notes: "審核中，預計 2 週內核准" },
  { caseId: caseIds[2], label: "農業資格一（一般農業）", category: "labor_in", qualType: "agriculture",
    employerName: "大成食品工業股份有限公司", employerTaxId: "11223344",
    applicationStatus: "preparing", quotaTotal: 4, docValidUntil: null, notes: "等待農委會配額開放" },
  { caseId: caseIds[3], label: "白領資格一（資訊工程）", category: "professional", qualType: "white_collar",
    employerName: "福爾摩沙電子股份有限公司", employerTaxId: "44332211",
    applicationStatus: "approved", quotaTotal: 2, docValidUntil: "2027-03-31", notes: "已核准，合約已生效" },
  { caseId: caseIds[4], label: "農業資格一（季節農業）", category: "labor_in", qualType: "agriculture",
    employerName: "中華農業開發股份有限公司", employerTaxId: "55667788",
    applicationStatus: "submitted", quotaTotal: 5, docValidUntil: "2025-10-31", notes: "已送件，等待審核" },
  { caseId: caseIds[5], label: "製造業資格一（續聘）", category: "labor_in", qualType: "manufacturing",
    employerName: "台灣精密科技股份有限公司", employerTaxId: "12345678",
    applicationStatus: "preparing", quotaTotal: 3, docValidUntil: null, notes: "續聘程序啟動中" },
  { caseId: caseIds[7], label: "家庭看護資格一", category: "labor_out", qualType: "caregiver",
    employerName: "王國華", employerTaxId: null,
    applicationStatus: "approved", quotaTotal: 1, docValidUntil: "2027-06-30", notes: "巴氏量表審核通過" },
];
for (const q of qualsData) {
  const [r] = await conn.execute(
    `INSERT INTO case_qualifications
      (caseId, label, category, qualType, employerName, employerTaxId, applicationStatus, quotaTotal, docValidUntil, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [q.caseId, q.label, q.category, q.qualType, q.employerName, q.employerTaxId,
     q.applicationStatus, q.quotaTotal, q.docValidUntil, q.notes]
  );
  qualIds.push(r.insertId);
}
console.log(`✅ 案件資格 ${qualIds.length} 筆`);

// 5b. case_demands
const demandIds = [];
const demandsData = [
  { caseId: caseIds[0], label: "製造業需求一（車床操作）", qualificationId: qualIds[0], qualType: "manufacturing", neededCount: 3, status: "filling", notes: "需具備車床操作經驗" },
  { caseId: caseIds[0], label: "製造業需求二（品管）", qualificationId: qualIds[0], qualType: "manufacturing", neededCount: 2, status: "open", notes: "品管人員，可接受無經驗" },
  { caseId: caseIds[1], label: "紡織需求一（縫紉）", qualificationId: qualIds[1], qualType: "manufacturing", neededCount: 2, status: "filling", notes: "需有縫紉機操作經驗" },
  { caseId: caseIds[1], label: "紡織需求二（包裝）", qualificationId: qualIds[1], qualType: "manufacturing", neededCount: 1, status: "fulfilled", notes: "包裝作業員，已媒合完成" },
  { caseId: caseIds[3], label: "工程師需求一（前端）", qualificationId: qualIds[3], qualType: "white_collar", neededCount: 1, status: "fulfilled", notes: "Vue.js 前端工程師" },
  { caseId: caseIds[3], label: "工程師需求二（後端）", qualificationId: qualIds[3], qualType: "white_collar", neededCount: 1, status: "fulfilled", notes: "Node.js 後端工程師" },
  { caseId: caseIds[4], label: "農業需求一（果園採收）", qualificationId: qualIds[4], qualType: "agriculture", neededCount: 3, status: "open", notes: "芒果採收季節工" },
  { caseId: caseIds[4], label: "農業需求二（蔬菜種植）", qualificationId: qualIds[4], qualType: "agriculture", neededCount: 2, status: "open", notes: "蔬菜種植與管理" },
  { caseId: caseIds[5], label: "製造業續聘需求", qualificationId: qualIds[5], qualType: "manufacturing", neededCount: 3, status: "open", notes: "現有移工合約到期前續聘" },
  { caseId: caseIds[7], label: "家庭看護需求", qualificationId: qualIds[6], qualType: "caregiver", neededCount: 1, status: "fulfilled", notes: "照顧失能長者" },
];
for (const d of demandsData) {
  const [r] = await conn.execute(
    `INSERT INTO case_demands
      (caseId, label, qualificationId, qualType, neededCount, status, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [d.caseId, d.label, d.qualificationId, d.qualType, d.neededCount, d.status, d.notes]
  );
  demandIds.push(r.insertId);
}
console.log(`✅ 案件需求 ${demandIds.length} 筆`);

// 5c. case_assignments
const assignmentIds = [];
const assignmentsData = [
  { caseId: caseIds[0], label: "第一批媒合（車床）", demandId: demandIds[0], qualificationId: qualIds[0], batchNote: "從越南招募 3 名車床操作員", notes: null },
  { caseId: caseIds[1], label: "第一批媒合（縫紉）", demandId: demandIds[2], qualificationId: qualIds[1], batchNote: "菲律賓縫紉工人", notes: null },
  { caseId: caseIds[3], label: "白領工程師媒合", demandId: demandIds[4], qualificationId: qualIds[3], batchNote: "越南工程師 2 名，已完成媒合", notes: "合約已生效" },
  { caseId: caseIds[4], label: "農業季節工媒合", demandId: demandIds[6], qualificationId: qualIds[4], batchNote: "泰國農業工人 3 名", notes: null },
  { caseId: caseIds[5], label: "續聘媒合批次", demandId: demandIds[8], qualificationId: qualIds[5], batchNote: "現有移工續聘評估", notes: null },
  { caseId: caseIds[7], label: "家庭看護媒合", demandId: demandIds[9], qualificationId: qualIds[6], batchNote: "印尼籍家庭看護", notes: null },
];
for (const a of assignmentsData) {
  const [r] = await conn.execute(
    `INSERT INTO case_assignments
      (caseId, label, demandId, qualificationId, batchNote, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [a.caseId, a.label, a.demandId, a.qualificationId, a.batchNote, a.notes]
  );
  assignmentIds.push(r.insertId);
}
console.log(`✅ 媒合批次 ${assignmentIds.length} 個`);

// 5d. case_assignment_workers
const assignmentWorkersData = [
  { assignmentId: assignmentIds[0], caseId: caseIds[0], workerId: W(0), stage: "confirmed", matchNote: "已確認，等待文件辦理", expectedDocDate: "2025-08-15", expectedEntryDate: "2025-09-01" },
  { assignmentId: assignmentIds[0], caseId: caseIds[0], workerId: W(1), stage: "candidate", matchNote: "評估中，需確認體檢結果", expectedDocDate: null, expectedEntryDate: null },
  { assignmentId: assignmentIds[0], caseId: caseIds[0], workerId: W(2), stage: "candidate", matchNote: "備選人員", expectedDocDate: null, expectedEntryDate: null },
  { assignmentId: assignmentIds[1], caseId: caseIds[1], workerId: W(3), stage: "employed", matchNote: "已入職，表現良好", expectedDocDate: "2025-05-01", expectedEntryDate: "2025-06-01" },
  { assignmentId: assignmentIds[1], caseId: caseIds[1], workerId: W(4), stage: "confirmed", matchNote: "確認入職，等待入境", expectedDocDate: "2025-07-01", expectedEntryDate: "2025-08-01" },
  { assignmentId: assignmentIds[2], caseId: caseIds[3], workerId: W(5), stage: "employed", matchNote: "前端工程師，已在職", expectedDocDate: "2025-01-15", expectedEntryDate: "2025-02-01" },
  { assignmentId: assignmentIds[2], caseId: caseIds[3], workerId: W(6), stage: "employed", matchNote: "後端工程師，已在職", expectedDocDate: "2025-01-15", expectedEntryDate: "2025-02-01" },
  { assignmentId: assignmentIds[3], caseId: caseIds[4], workerId: W(7), stage: "upcoming", matchNote: "即將入境，文件已備妥", expectedDocDate: "2025-03-20", expectedEntryDate: "2025-04-01" },
  { assignmentId: assignmentIds[3], caseId: caseIds[4], workerId: W(8), stage: "candidate", matchNote: "備選", expectedDocDate: null, expectedEntryDate: null },
  { assignmentId: assignmentIds[4], caseId: caseIds[5], workerId: W(0), stage: "candidate", matchNote: "評估是否續聘", expectedDocDate: null, expectedEntryDate: null },
  { assignmentId: assignmentIds[4], caseId: caseIds[5], workerId: W(2), stage: "candidate", matchNote: "評估是否續聘", expectedDocDate: null, expectedEntryDate: null },
  { assignmentId: assignmentIds[5], caseId: caseIds[7], workerId: W(9), stage: "employed", matchNote: "家庭看護，已上工", expectedDocDate: "2024-09-15", expectedEntryDate: "2024-10-01" },
];
for (const aw of assignmentWorkersData) {
  await conn.execute(
    `INSERT INTO case_assignment_workers
      (assignmentId, caseId, workerId, stage, matchNote, expectedDocDate, expectedEntryDate, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [aw.assignmentId, aw.caseId, aw.workerId, aw.stage, aw.matchNote, aw.expectedDocDate, aw.expectedEntryDate]
  );
}
console.log(`✅ 媒合成員 ${assignmentWorkersData.length} 筆`);

// 5e. case_employments
const employmentsData = [
  { caseId: caseIds[1], workerId: W(3), qualificationId: qualIds[1], position: "縫紉操作員", contractStart: "2025-06-01", contractEnd: "2028-05-31", status: "active", notes: "合約 3 年，表現良好" },
  { caseId: caseIds[3], workerId: W(5), qualificationId: qualIds[3], position: "前端工程師", contractStart: "2025-02-01", contractEnd: "2027-01-31", status: "active", notes: "白領工程師，合約 2 年" },
  { caseId: caseIds[3], workerId: W(6), qualificationId: qualIds[3], position: "後端工程師", contractStart: "2025-02-01", contractEnd: "2027-01-31", status: "active", notes: "白領工程師，合約 2 年" },
  { caseId: caseIds[7], workerId: W(9), qualificationId: qualIds[6], position: "家庭看護工", contractStart: "2024-10-01", contractEnd: "2027-09-30", status: "active", notes: "照顧失能長者，合約 3 年" },
];
for (const e of employmentsData) {
  await conn.execute(
    `INSERT INTO case_employments
      (caseId, workerId, qualificationId, position, contractStart, contractEnd, status, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [e.caseId, e.workerId, e.qualificationId, e.position, e.contractStart, e.contractEnd, e.status, e.notes]
  );
}
console.log(`✅ 正式聘僱 ${employmentsData.length} 筆`);

await conn.end();
console.log("\n🎉 模擬資料產生完成！");
