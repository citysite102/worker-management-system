/**
 * Demo 資料 seed（idempotent）：為本地開發／展示灌入完整的
 *   - 客戶（customers）25 筆（個人雇主 + 公司行號混合）
 *   - 移工名冊（workers）25 筆
 *   - 移工帳號 + 匿名公開履歷（worker_public_profiles，published+approved）25 筆
 *     → 直接出現在公開站「找移工」
 *   - 自填經歷（worker_experiences，approved）約 40 筆
 *   - 雇主帳號 12 個 + 需求單（job_postings，approved）25 筆
 *     → 直接出現在公開站「找工作」
 *
 * 全部以標記識別（customers.employerNo / workers.workerNo 前綴 DEMO-、
 * users.email 網域 @seed.local），重跑會先清掉舊 demo 資料再重建，不會重複累加。
 *
 * 用法：node -r dotenv/config scripts/seed-marketplace-demo.mjs
 * 前置：需已跑過 migrate-marketplace-p1 / -worker-profiles / -match-requests。
 */
import mysql from "mysql2/promise";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
async function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(pw, salt, 64);
  return `scrypt$${salt}$${buf.toString("hex")}`;
}

const N = 25; // 每種主要實體的筆數
const PASSWORD = "test1234";

// ─── 隨機但可重現的資料池 ────────────────────────────────────────────────────
const NATIONS = [
  {
    zh: "印尼",
    code: "009 印尼",
    names: [
      "Siti",
      "Dewi",
      "Ayu",
      "Rina",
      "Putri",
      "Wati",
      "Sari",
      "Indah",
      "Nur",
      "Eka",
    ],
    langs: ["印尼文", "中文"],
  },
  {
    zh: "越南",
    code: "010 越南",
    names: [
      "Linh",
      "Huong",
      "Mai",
      "Lan",
      "Thao",
      "Trang",
      "Hoa",
      "Yen",
      "Ngoc",
      "Thu",
    ],
    langs: ["越南文", "中文"],
  },
  {
    zh: "菲律賓",
    code: "011 菲律賓",
    names: [
      "Maria",
      "Rose",
      "Grace",
      "Jenny",
      "Ana",
      "Cristy",
      "Liza",
      "Joy",
      "Nena",
      "Divine",
    ],
    langs: ["英文", "他加祿語", "中文"],
  },
  {
    zh: "泰國",
    code: "012 泰國",
    names: [
      "Nid",
      "Pim",
      "Som",
      "Ploy",
      "Fon",
      "Nan",
      "Ying",
      "Nok",
      "Aor",
      "Ming",
    ],
    langs: ["泰文", "中文"],
  },
];
const SURNAMES = [
  "Wijaya",
  "Nguyen",
  "Santos",
  "Suksan",
  "Pratama",
  "Tran",
  "Reyes",
  "Chai",
  "Putra",
  "Le",
];

const CITIES = [
  { city: "臺北市", districts: ["大安區", "士林區", "內湖區", "中山區"] },
  { city: "新北市", districts: ["板橋區", "新莊區", "中和區", "三重區"] },
  { city: "桃園市", districts: ["中壢區", "桃園區", "龜山區", "平鎮區"] },
  { city: "臺中市", districts: ["西屯區", "北屯區", "南屯區", "大里區"] },
  { city: "臺南市", districts: ["永康區", "安南區", "東區", "北區"] },
  { city: "高雄市", districts: ["三民區", "左營區", "鳳山區", "楠梓區"] },
  { city: "新竹市", districts: ["東區", "北區", "香山區"] },
  { city: "彰化縣", districts: ["彰化市", "員林市", "和美鎮"] },
];

// jobType enum → 職類設定（技能、經歷型別、說明模板）
const JOBS = [
  {
    jobType: "caregiver",
    occupation: "caregiver_family",
    expType: "family_care",
    roles: ["家庭看護工", "臥床長輩照顧", "失智症陪伴"],
    skills: ["翻身拍背", "餵食", "備餐", "血壓量測", "陪同就醫", "管路照護"],
    headline: "細心有耐心的家庭看護，熟悉長輩起居照護",
    desc: "照顧一位行動不便長輩，含備餐、翻身拍背、陪同就醫與基本家務。",
    reqs: "有長照或看護經驗尤佳；能溝通基本中文。",
    empType: "live_in",
    salary: [28000, 32000],
  },
  {
    jobType: "domestic_helper",
    occupation: "caregiver_family",
    expType: "family_care",
    roles: ["家庭幫傭", "家務清潔", "煮食備餐"],
    skills: ["打掃", "洗衣", "烹飪", "採買", "照顧孩童"],
    headline: "勤快俐落的家庭幫傭，家務烹飪一手包辦",
    desc: "一般家庭清潔、洗衣、備三餐，偶爾協助照顧學齡孩童。",
    reqs: "會簡易家常菜；配合雙薪家庭作息。",
    empType: "live_in",
    salary: [26000, 30000],
  },
  {
    jobType: "manufacturing",
    occupation: "manufacturing",
    expType: "manufacturing",
    roles: ["產線作業員", "包裝人員", "品檢"],
    skills: ["機台操作", "包裝", "品檢", "堆疊", "看板管理"],
    headline: "配合輪班的產線作業員，動作俐落穩定",
    desc: "電子零件產線作業，三班輪班，含基本機台操作與包裝。",
    reqs: "可配合輪班；站立作業無虞。",
    empType: "live_out",
    salary: [30000, 36000],
  },
  {
    jobType: "agriculture",
    occupation: "agriculture",
    expType: "agriculture",
    roles: ["農務工", "採收人員", "溫室管理"],
    skills: ["採收", "施肥", "除草", "包裝", "溫室管理"],
    headline: "耐操肯做的農務工，熟悉溫室與採收",
    desc: "蔬果溫室日常管理、採收與分級包裝。",
    reqs: "能適應戶外／溫室環境。",
    empType: "live_out",
    salary: [29000, 34000],
  },
  {
    jobType: "construction",
    occupation: "construction",
    expType: "construction",
    roles: ["營造工", "模板工", "鋼筋工"],
    skills: ["模板", "鋼筋綁紮", "搬運", "泥作", "安全防護"],
    headline: "有工地經驗的營造工，重視工安",
    desc: "一般土木工程之模板／鋼筋作業與物料搬運。",
    reqs: "具工地經驗；遵守工安規範。",
    empType: "live_out",
    salary: [33000, 40000],
  },
  {
    jobType: "intermediate",
    occupation: "caregiver_hospital",
    expType: "institution",
    roles: ["機構看護", "中階技術人力", "護理輔助"],
    skills: ["生命徵象量測", "協助復健", "衛教", "紀錄", "感染控制"],
    headline: "具機構經驗的中階看護人力，穩定可靠",
    desc: "長照機構住民日常照護與復健協助，配合護理排班。",
    reqs: "符合中階技術人力資格；具機構照護經驗。",
    empType: "institution",
    salary: [32000, 38000],
  },
];

const AVAILS = [
  "即刻可上工",
  "兩週後可上工",
  "一個月內可上工",
  "農曆年後可上工",
];
const INDUSTRIES = [
  "電子製造",
  "食品加工",
  "金屬加工",
  "塑膠製品",
  "紡織",
  "物流倉儲",
  "農業生產",
  "營造工程",
];

const pick = (arr, i) => arr[i % arr.length];
const pad = (n, w = 3) => String(n).padStart(w, "0");
const tw = d => d.toISOString().slice(0, 10);
function dateShift(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return tw(d);
}
const jsonArr = a => JSON.stringify(a);

// 與後端 moderation.approvePosting 對齊（server/routers.ts），讓 seed 建的案件
// 與正規審核流程產出的一致。
const QUAL_TYPE_LABEL = {
  caregiver: "看護",
  domestic_helper: "幫傭",
  manufacturing: "製造業",
  agriculture: "農業",
  construction: "營造業",
  white_collar: "白領",
  intermediate: "中階技術",
  overseas_student: "僑外生",
};
function inferQualCategory(qualType) {
  if (["white_collar", "overseas_student", "intermediate"].includes(qualType))
    return "professional";
  if (["caregiver", "domestic_helper"].includes(qualType)) return "labor_out";
  return "labor_in";
}

// ─── 連線 ────────────────────────────────────────────────────────────────────
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL 未設定（請用 node -r dotenv/config ...）");
  process.exit(1);
}
const conn = await mysql.createConnection(dbUrl);
const q = (sql, params = []) => conn.execute(sql, params);

// manager 池（用既有的）
const [mgrs] = await q("SELECT id FROM managers ORDER BY id");
if (mgrs.length === 0) {
  console.error("managers 表為空，請先建立至少一位承辦人。");
  process.exit(1);
}
const managerIds = mgrs.map(m => m.id);

// ─── 清掉舊 demo 資料（idempotent）──────────────────────────────────────────
console.log("→ 清除既有 demo 資料 …");
const [demoUsers] = await q(
  "SELECT id FROM users WHERE email LIKE 'demo.%@seed.local'"
);
const demoUserIds = demoUsers.map(u => u.id);
if (demoUserIds.length > 0) {
  const ph = demoUserIds.map(() => "?").join(",");
  await q(
    `DELETE FROM worker_public_profiles WHERE userId IN (${ph})`,
    demoUserIds
  );
  await q(
    `DELETE FROM worker_experiences WHERE userId IN (${ph})`,
    demoUserIds
  );
  await q(
    `DELETE FROM match_requests WHERE initiatorUserId IN (${ph})`,
    demoUserIds
  );
  await q(
    `DELETE FROM job_postings WHERE employerUserId IN (${ph})`,
    demoUserIds
  );
  await q(`DELETE FROM users WHERE id IN (${ph})`, demoUserIds);
}
// demo 案件（notes 標記）：先清子表（FK 由子到父），再清案件，最後才刪客戶。
const DEMO_CASE =
  "WHERE caseId IN (SELECT id FROM `cases` WHERE notes = '[seed-demo]')";
await q(`DELETE FROM case_demands ${DEMO_CASE}`);
await q(`DELETE FROM case_qualifications ${DEMO_CASE}`);
await q("DELETE FROM `cases` WHERE notes = '[seed-demo]'");
await q("DELETE FROM customers WHERE employerNo LIKE 'DEMO-%'");
await q("DELETE FROM workers WHERE workerNo LIKE 'DEMO-%'");

const passwordHash = await hashPassword(PASSWORD);

// ─── 1) 客戶（customers）25 筆 ───────────────────────────────────────────────
console.log(`→ 建立 ${N} 筆客戶 …`);
const customerIds = [];
for (let i = 0; i < N; i++) {
  const isCompany = i % 2 === 0;
  const loc = pick(CITIES, i);
  const mgr = pick(managerIds, i);
  const employerNo = `DEMO-C${pad(i + 1)}`;
  if (isCompany) {
    const industry = pick(INDUSTRIES, i);
    const [r] = await q(
      `INSERT INTO customers
        (employerType, name, employerNo, phone, landline, address, registeredAddress,
         taxId, industry, contactName, contactPhone, contractStatus, pricingTier, managerId, notes)
       VALUES ('company', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_service', 'standard', ?, '[seed-demo]')`,
      [
        `${industry}${pick(["科技", "實業", "企業", "工業"], i)}有限公司`,
        employerNo,
        `02-2${pad(100 + i, 3)}-${pad(1000 + i, 4)}`,
        `02-8${pad(200 + i, 3)}-${pad(2000 + i, 4)}`,
        `${loc.city}${pick(loc.districts, i)}中山路${i + 1}號`,
        `${loc.city}${pick(loc.districts, i)}中山路${i + 1}號`,
        pad(12340000 + i, 8),
        industry,
        `聯絡人${pad(i + 1)}`,
        `09${pad(10000000 + i * 7, 8)}`,
        mgr,
      ]
    );
    customerIds.push(r.insertId);
  } else {
    const [r] = await q(
      `INSERT INTO customers
        (employerType, name, employerNo, phone, address, registeredAddress,
         idNo, careReceiverName, careReceiverRelation, contractStatus, pricingTier, managerId, notes)
       VALUES ('individual', ?, ?, ?, ?, ?, ?, ?, ?, 'in_service', 'standard', ?, '[seed-demo]')`,
      [
        `${pick(["陳", "林", "黃", "張", "李", "王", "吳", "劉"], i)}${pick(["先生", "女士"], i)}`,
        employerNo,
        `09${pad(20000000 + i * 13, 8)}`,
        `${loc.city}${pick(loc.districts, i)}民生路${i + 1}巷${i + 3}號`,
        `${loc.city}${pick(loc.districts, i)}民生路${i + 1}巷${i + 3}號`,
        `A1${pad(20000000 + i, 8)}`,
        `${pick(["陳", "林", "黃", "張", "李"], i + 1)}阿${pick(["嬤", "公", "婆"], i)}`,
        pick(["母子", "父女", "祖孫", "配偶"], i),
        mgr,
      ]
    );
    customerIds.push(r.insertId);
  }
}

// ─── 2) 移工名冊（workers）25 筆 ─────────────────────────────────────────────
console.log(`→ 建立 ${N} 筆移工名冊 …`);
const workerIds = [];
for (let i = 0; i < N; i++) {
  const nat = pick(NATIONS, i);
  const job = pick(JOBS, i);
  const mgr = pick(managerIds, i);
  const first = pick(nat.names, i);
  const last = pick(SURNAMES, i);
  const birth = `19${85 + (i % 15)}-${pad((i % 12) + 1, 2)}-${pad((i % 27) + 1, 2)}`;
  const [r] = await q(
    `INSERT INTO workers
      (workerNo, name, nameEn, gender, birthDate, nationality, birthPlace, occupation,
       lifecycleStatus, documentStatus, managerId,
       residentPermitNo, residentPermitExpiry, passportNo, passportExpiry, entryDate,
       phone, email, lastMedicalExamDate, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[seed-demo]')`,
    [
      `DEMO-W${pad(i + 1)}`,
      `${first} ${last}`,
      `${first} ${last}`,
      i % 3 === 0 ? "male" : "female",
      birth,
      nat.code,
      nat.zh,
      job.occupation,
      pick(["idle_in_tw", "preparing_abroad", "employed"], i),
      pick(["complete", "pending_supplement", "expiring_soon"], i),
      mgr,
      `AC${pad(30000000 + i, 8)}`,
      dateShift(12 + (i % 24)),
      `P${pad(1000000 + i * 37, 7)}`,
      dateShift(24 + (i % 36)),
      dateShift(-(i % 30) - 1),
      `09${pad(30000000 + i * 17, 8)}`,
      `demo.worker${pad(i + 1)}@seed.local`,
      dateShift(-(i % 6)),
    ]
  );
  workerIds.push(r.insertId);
}

// ─── 3) 移工帳號 + 匿名公開履歷（published + approved）25 筆 ─────────────────
console.log(`→ 建立 ${N} 個移工帳號 + 公開履歷 …`);
for (let i = 0; i < N; i++) {
  const nat = pick(NATIONS, i);
  const job = pick(JOBS, i);
  const first = pick(nat.names, i);
  const email = `demo.worker${pad(i + 1)}@seed.local`;
  const [u] = await q(
    `INSERT INTO users (openId, email, name, loginMethod, role, accountType, passwordHash, lastSignedIn)
     VALUES (?, ?, ?, 'email', 'user', 'worker', ?, NOW())`,
    [`demo_worker_${i + 1}`, email, first, passwordHash]
  );
  const userId = u.insertId;
  const yearOfBirth = 1985 + (i % 15);
  // 技能取 3~4 個
  const skills = job.skills.filter((_, k) => (k + i) % 2 === 0).slice(0, 4);
  // 評分：約每 5 位有 1 位未達門檻（count < 5 → 前端不顯示星等），其餘 5~11 則。
  const ratingCount = i % 5 === 0 ? i % 5 : 5 + (i % 7);
  const ratingAvg = 42 + (i % 9); // 4.2 ~ 5.0（存 ×10）
  // 期望職類多選：約每 3 位有 1 位選第二個相關職類，示範多選。
  const jobTypesArr = [job.jobType];
  if (i % 3 === 0) {
    const extra = pick(JOBS, i + 2).jobType;
    if (extra !== job.jobType) jobTypesArr.push(extra);
  }
  await q(
    `INSERT INTO worker_public_profiles
      (userId, workerId, alias, headline, nationality, yearOfBirth, jobType, jobTypes,
       skills, languages, availability, selfIntro, ratingAvg, ratingCount, publishStatus, moderationStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 'approved')`,
    [
      userId,
      workerIds[i],
      `${first}（${nat.zh}）`,
      job.headline,
      nat.zh,
      yearOfBirth,
      job.jobType,
      jsonArr(jobTypesArr),
      jsonArr(skills.length ? skills : job.skills.slice(0, 3)),
      jsonArr(nat.langs),
      pick(AVAILS, i),
      `我是來自${nat.zh}的${pick(job.roles, i)}，有 ${2 + (i % 6)} 年相關經驗，個性${pick(["細心", "勤快", "有耐心", "認真負責"], i)}，希望找到穩定的工作，能長期配合。`,
      ratingAvg,
      ratingCount,
    ]
  );

  // 自填經歷：每人 1~2 筆（approved）
  const expCount = (i % 2) + 1;
  for (let e = 0; e < expCount; e++) {
    const startY = 2016 + ((i + e) % 6);
    const endY = startY + 2 + (e % 2);
    await q(
      `INSERT INTO worker_experiences
        (userId, employerType, role, startDate, endDate, description, reviewStatus)
       VALUES (?, ?, ?, ?, ?, ?, 'approved')`,
      [
        userId,
        job.expType,
        pick(job.roles, i + e),
        `${startY}-0${(e % 8) + 1}`,
        `${endY}-0${(e % 8) + 2}`,
        `於${pick(NATIONS, i + e).zh}／臺灣擔任${pick(job.roles, i + e)}，負責${pick(job.skills, i + e)}等工作。`,
      ]
    );
  }
}

// ─── 4) 雇主帳號（12）+ 需求單（job_postings，approved）25 筆 ────────────────
console.log("→ 建立 12 個雇主帳號 …");
const employerUserIds = [];
for (let i = 0; i < 12; i++) {
  const email = `demo.employer${pad(i + 1)}@seed.local`;
  const [u] = await q(
    `INSERT INTO users (openId, email, name, loginMethod, role, accountType, passwordHash, lastSignedIn)
     VALUES (?, ?, ?, 'email', 'user', 'employer', ?, NOW())`,
    [`demo_employer_${i + 1}`, email, `Demo 雇主 ${pad(i + 1)}`, passwordHash]
  );
  employerUserIds.push(u.insertId);
}

console.log(
  `→ 建立 ${N} 筆需求單（approved）＋對應案件（前後台一致：走正規審核產物）…`
);
for (let i = 0; i < N; i++) {
  const job = pick(JOBS, i);
  const loc = pick(CITIES, i);
  const [min, max] = job.salary;
  const customerId = pick(customerIds, i);
  const mgr = pick(managerIds, i);
  const headcount = 1 + (i % 3);
  const jobLabel = QUAL_TYPE_LABEL[job.jobType];

  // 需求單
  const [posting] = await q(
    `INSERT INTO job_postings
      (employerUserId, customerId, jobType, city, district, headcount, employmentType,
       requirements, publicDescription, salaryMin, salaryMax, expectedStartDate,
       status, publishedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', NOW())`,
    [
      pick(employerUserIds, i),
      customerId,
      job.jobType,
      loc.city,
      pick(loc.districts, i),
      headcount,
      job.empType,
      job.reqs,
      job.desc,
      min + (i % 3) * 1000,
      max + (i % 3) * 1000,
      dateShift((i % 3) + 1),
    ]
  );

  // 對應案件 + 資格 + 需求（等同 moderation.approvePosting 的產物；notes 標記供清理）
  const [c] = await q(
    `INSERT INTO \`cases\` (customerId, name, managerId, status, publicCity, notes)
     VALUES (?, ?, ?, 'in_progress', ?, '[seed-demo]')`,
    [customerId, `${jobLabel}－${loc.city}`, mgr, loc.city]
  );
  const caseId = c.insertId;
  const [qual] = await q(
    `INSERT INTO case_qualifications
       (caseId, label, category, qualType, quotaTotal, applicationStatus)
     VALUES (?, ?, ?, ?, ?, 'preparing')`,
    [
      caseId,
      `${jobLabel}（公開需求單）`,
      inferQualCategory(job.jobType),
      job.jobType,
      headcount,
    ]
  );
  await q(
    `INSERT INTO case_demands
       (caseId, label, qualificationId, qualType, neededCount, status, publicHidden)
     VALUES (?, ?, ?, ?, ?, 'open', 1)`,
    [caseId, `${jobLabel}－${loc.city}`, qual.insertId, job.jobType, headcount]
  );
  // 回填需求單 → 案件連結
  await q("UPDATE job_postings SET caseId = ? WHERE id = ?", [
    caseId,
    posting.insertId,
  ]);
}

// ─── 摘要 ────────────────────────────────────────────────────────────────────
const count = async t => (await q(`SELECT COUNT(*) n FROM ${t}`))[0][0].n;
console.log("\n✓ 完成。目前資料表筆數：");
for (const t of [
  "customers",
  "workers",
  "users",
  "worker_public_profiles",
  "worker_experiences",
  "job_postings",
]) {
  console.log(`   ${t.padEnd(24)} ${await count(t)}`);
}
console.log(
  `\n公開站可見：找工作 = approved job_postings（${await q(
    "SELECT COUNT(*) n FROM job_postings WHERE status='approved'"
  ).then(r => r[0][0].n)} 筆）；找移工 = published+approved 履歷（${await q(
    "SELECT COUNT(*) n FROM worker_public_profiles WHERE publishStatus='published' AND moderationStatus='approved'"
  ).then(r => r[0][0].n)} 筆）`
);
console.log(
  `\ndemo 帳號密碼一律：${PASSWORD}（移工 demo.worker001@seed.local … / 雇主 demo.employer001@seed.local …）`
);
await conn.end();
