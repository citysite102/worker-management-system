import {
  and,
  desc,
  eq,
  inArray,
  like,
  lt,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  managers,
  workers,
  customers,
  InsertManager,
  InsertWorker,
  InsertCustomer,
  cases,
  caseQualifications,
  caseDemands,
  caseAssignments,
  caseAssignmentWorkers,
  caseEmployments,
  InsertCase,
  InsertCaseQualification,
  InsertCaseDemand,
  InsertCaseAssignment,
  InsertCaseAssignmentWorker,
  InsertCaseEmployment,
  customerCareReceivers,
  customerQualifications,
  InsertCustomerCareReceiver,
  InsertCustomerQualification,
  kpiSnapshots,
  InsertKpiSnapshot,
  KpiSnapshot,
  auditLogs,
  InsertAuditLog,
  jobPostings,
  InsertJobPosting,
  moderationEvents,
  InsertModerationEvent,
  matchRequests,
  InsertMatchRequest,
  workerPublicProfiles,
  InsertWorkerPublicProfile,
  workerExperiences,
  InsertWorkerExperience,
  ratings,
  InsertRating,
  oauthIdentities,
  InsertOAuthIdentity,
  phoneOtps,
  InsertPhoneOtp,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0)
      updateSet.lastSignedIn = new Date();
    await db
      .insert(users)
      .values(values)
      .onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** 依 id 查使用者（審核需求單時帶出雇主帳號資訊）。 */
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

/** 依 email 查使用者（Email/密碼登入用；email 非唯一，取第一筆）。 */
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** 建立使用者（Email/密碼註冊用），回傳新 id。 */
export async function createUser(data: InsertUser): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(users).values(data));
}

/**
 * 從 drizzle/mysql2 的 insert 結果取出自動遞增的主鍵。
 *
 * mysql2 回傳的形狀會依呼叫方式而異（有時是 [ResultSetHeader, fields]，
 * 有時直接是 ResultSetHeader），因此兩種都試。集中在這裡處理，避免每個
 * create 函式各自複製一份 `as any` 的取值邏輯。
 */
function insertedId(result: unknown): number {
  const r = result as { insertId?: number } & Array<{ insertId?: number }>;
  const id = r?.[0]?.insertId ?? r?.insertId;
  if (id === undefined || id === null) throw new Error("插入後取不到 insertId");
  return Number(id);
}

// ─── Audit Logs（稽核）───────────────────────────────────────────────────────
/**
 * 寫一筆操作稽核。fail-safe：稽核寫入失敗只記 console，絕不讓呼叫端的主流程失敗
 * （稽核是輔助，不能因為它掛掉而擋住登入/登出等操作）。無 DB 連線時直接略過。
 */
export async function createAuditLog(entry: InsertAuditLog): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(auditLogs).values(entry);
  } catch (error) {
    console.error("[audit] createAuditLog 失敗（不影響主流程）：", error);
  }
}

// ─── Managers ────────────────────────────────────────────────────────────────
export async function getAllManagers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(managers).orderBy(managers.id);
}

export async function createManager(data: InsertManager): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(managers).values(data));
}

/** 指派給此負責人的移工／雇主／案件筆數 —— 用來判斷可不可以刪。 */
export async function countDependentsByManager(managerId: number) {
  const db = await getDb();
  if (!db) return { workers: 0, customers: 0, cases: 0 };
  const count = sql<number>`count(*)`;
  const [w, c, k] = await Promise.all([
    db.select({ count }).from(workers).where(eq(workers.managerId, managerId)),
    db
      .select({ count })
      .from(customers)
      .where(eq(customers.managerId, managerId)),
    db.select({ count }).from(cases).where(eq(cases.managerId, managerId)),
  ]);
  return {
    workers: Number(w[0]?.count ?? 0),
    customers: Number(c[0]?.count ?? 0),
    cases: Number(k[0]?.count ?? 0),
  };
}

/**
 * 刪除負責人。
 *
 * 還有移工／雇主／案件指派給他時不會刪 —— 呼叫端負責先擋掉並回報。
 * 資料庫層現在也有 FK 約束擋著，但那會噴出原始 SQL 錯誤，
 * 使用者看不懂，所以應用層要先給出可讀的訊息。
 */
export async function deleteManager(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(managers).where(eq(managers.id, id));
}

// ─── Workers ─────────────────────────────────────────────────────────────────
export async function getAllWorkers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workers).orderBy(workers.createdAt);
}

export async function getWorkerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(workers)
    .where(eq(workers.id, id))
    .limit(1);
  return result[0];
}

/** 依居留證號查重（排除自身） */
export async function getWorkerByPermitNo(
  permitNo: string,
  excludeId?: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const conditions = excludeId
    ? and(eq(workers.residentPermitNo, permitNo), ne(workers.id, excludeId))
    : eq(workers.residentPermitNo, permitNo);
  const result = await db.select().from(workers).where(conditions).limit(1);
  return result[0];
}

/** 依護照號查重（排除自身） */
export async function getWorkerByPassportNo(
  passportNo: string,
  excludeId?: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const conditions = excludeId
    ? and(eq(workers.passportNo, passportNo), ne(workers.id, excludeId))
    : eq(workers.passportNo, passportNo);
  const result = await db.select().from(workers).where(conditions).limit(1);
  return result[0];
}

/** 相容舊版：依任一證號查重 */
export async function getWorkerByIdNumber(
  idNumber: string,
  excludeId?: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const permitResult = await getWorkerByPermitNo(idNumber, excludeId);
  if (permitResult) return permitResult;
  return getWorkerByPassportNo(idNumber, excludeId);
}

export async function createWorker(data: InsertWorker): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(workers).values(data));
}

export async function updateWorker(id: number, data: Partial<InsertWorker>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(workers).set(data).where(eq(workers.id, id));
}

export async function deleteWorker(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(workers).where(eq(workers.id, id));
}

// ─── Customers ───────────────────────────────────────────────────────────────
export async function getAllCustomers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customers).orderBy(customers.createdAt);
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  return result[0];
}

export async function getCustomerByTaxId(taxId: string, excludeId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const conditions = excludeId
    ? and(eq(customers.taxId, taxId), ne(customers.id, excludeId))
    : eq(customers.taxId, taxId);
  const result = await db.select().from(customers).where(conditions).limit(1);
  return result[0];
}

export async function getCustomerByName(name: string, excludeId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const conditions = excludeId
    ? and(eq(customers.name, name), ne(customers.id, excludeId))
    : eq(customers.name, name);
  const result = await db.select().from(customers).where(conditions).limit(1);
  return result[0];
}

export async function createCustomer(data: InsertCustomer): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(customers).values(data));
}

export async function updateCustomer(
  id: number,
  data: Partial<InsertCustomer>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(customers).set(data).where(eq(customers.id, id));
}

/** 該雇主底下的案件數 —— 用來判斷可不可以刪。 */
export async function countCasesByCustomer(
  customerId: number
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(cases)
    .where(eq(cases.customerId, customerId));
  return Number(rows[0]?.count ?? 0);
}

/**
 * 刪除雇主。
 *
 * 底下還有案件時不會刪 —— 呼叫端（routers.ts）負責先擋掉並回報錯誤。
 * 案件牽涉勞動部許可函與聘僱契約，誤刪難以回復，因此採「擋下」而非「連坐刪除」。
 *
 * 沒有案件時才刪，並連動清掉被照顧者與客戶資格 —— 這兩張表沒有獨立意義，
 * 留著只會變成查不到來源的孤兒列。
 */
export async function deleteCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .delete(customerCareReceivers)
    .where(eq(customerCareReceivers.customerId, id));
  await db
    .delete(customerQualifications)
    .where(eq(customerQualifications.customerId, id));
  return db.delete(customers).where(eq(customers.id, id));
}

// ─── Cases（案件）────────────────────────────────────────────────────────────
export async function getAllCases(filters?: {
  customerId?: number;
  status?: string;
  managerId?: number;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(cases).orderBy(cases.createdAt);
  let result = rows;
  if (filters?.customerId)
    result = result.filter(c => c.customerId === filters.customerId);
  if (filters?.status) result = result.filter(c => c.status === filters.status);
  if (filters?.managerId)
    result = result.filter(c => c.managerId === filters.managerId);
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(c => c.name.toLowerCase().includes(s));
  }
  return result;
}

export async function getCaseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
  return result[0];
}

export async function createCase(data: InsertCase): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(cases).values(data));
}

export async function updateCase(id: number, data: Partial<InsertCase>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(cases).set(data).where(eq(cases.id, id));
}

export async function deleteCase(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // 連動刪除：先刪成員，再刪配對，再刪需求/資格，最後刪案件
  const assignments = await db
    .select({ id: caseAssignments.id })
    .from(caseAssignments)
    .where(eq(caseAssignments.caseId, id));
  for (const a of assignments) {
    await db
      .delete(caseAssignmentWorkers)
      .where(eq(caseAssignmentWorkers.assignmentId, a.id));
  }
  await db.delete(caseAssignments).where(eq(caseAssignments.caseId, id));
  await db.delete(caseDemands).where(eq(caseDemands.caseId, id));
  await db.delete(caseQualifications).where(eq(caseQualifications.caseId, id));
  return db.delete(cases).where(eq(cases.id, id));
}

/** 計算案件底下各子資料的數量（用於刪除前提示） */
export async function getCaseChildCounts(caseId: number) {
  const db = await getDb();
  if (!db)
    return { qualCount: 0, demandCount: 0, assignmentCount: 0, memberCount: 0 };
  // 全部下推成 count(*)：原本把整批資料撈回來再用 .length 計數，成員數還逐一
  // assignment 查一次（N+1）。改成四個平行聚合查詢，成員數用 join 一次算完，
  // 查詢次數不再隨 assignment 數量增加。
  const [quals, demands, assignments, members] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(caseQualifications)
      .where(eq(caseQualifications.caseId, caseId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(caseDemands)
      .where(eq(caseDemands.caseId, caseId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(caseAssignments)
      .where(eq(caseAssignments.caseId, caseId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(caseAssignmentWorkers)
      .innerJoin(
        caseAssignments,
        eq(caseAssignmentWorkers.assignmentId, caseAssignments.id)
      )
      .where(eq(caseAssignments.caseId, caseId)),
  ]);
  return {
    qualCount: Number(quals[0]?.count ?? 0),
    demandCount: Number(demands[0]?.count ?? 0),
    assignmentCount: Number(assignments[0]?.count ?? 0),
    memberCount: Number(members[0]?.count ?? 0),
  };
}

// ─── Case Qualifications（資格）─────────────────────────────────────────────
export async function getQualificationsByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(caseQualifications)
    .where(eq(caseQualifications.caseId, caseId))
    .orderBy(caseQualifications.id);
}

export async function getQualificationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(caseQualifications)
    .where(eq(caseQualifications.id, id))
    .limit(1);
  return result[0];
}

export async function createQualification(
  data: InsertCaseQualification
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(caseQualifications).values(data));
}

export async function updateQualification(
  id: number,
  data: Partial<InsertCaseQualification>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .update(caseQualifications)
    .set(data)
    .where(eq(caseQualifications.id, id));
}

export async function deleteQualification(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // 解除配對的 qualificationId 連結（不刪配對）
  await db
    .update(caseAssignments)
    .set({ qualificationId: null })
    .where(eq(caseAssignments.qualificationId, id));
  return db.delete(caseQualifications).where(eq(caseQualifications.id, id));
}

/** 計算資格的 quotaUsed（employed 成員數） */
export async function getQuotaUsed(qualificationId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const assignmentRows = await db
    .select({ id: caseAssignments.id })
    .from(caseAssignments)
    .where(eq(caseAssignments.qualificationId, qualificationId));
  if (assignmentRows.length === 0) return 0;
  const assignmentIds = assignmentRows.map(a => a.id);
  const members = await db
    .select()
    .from(caseAssignmentWorkers)
    .where(
      and(
        inArray(caseAssignmentWorkers.assignmentId, assignmentIds),
        eq(caseAssignmentWorkers.stage, "employed")
      )
    );
  return members.length;
}

/** 批次計算多個資格的 quotaUsed（消除 N+1） */
export async function getQuotaUsedBatch(
  qualificationIds: number[]
): Promise<Map<number, number>> {
  const result = new Map<number, number>(qualificationIds.map(id => [id, 0]));
  if (qualificationIds.length === 0) return result;
  const db = await getDb();
  if (!db) return result;
  const assignmentRows = await db
    .select({
      id: caseAssignments.id,
      qualificationId: caseAssignments.qualificationId,
    })
    .from(caseAssignments)
    .where(inArray(caseAssignments.qualificationId, qualificationIds));
  if (assignmentRows.length === 0) return result;
  const assignmentIds = assignmentRows.map(a => a.id);
  const members = await db
    .select({ assignmentId: caseAssignmentWorkers.assignmentId })
    .from(caseAssignmentWorkers)
    .where(
      and(
        inArray(caseAssignmentWorkers.assignmentId, assignmentIds),
        eq(caseAssignmentWorkers.stage, "employed")
      )
    );
  // 將 assignmentId 對映回 qualificationId
  const assignmentToQual = new Map(
    assignmentRows.map(a => [a.id, a.qualificationId!])
  );
  for (const m of members) {
    const qualId = assignmentToQual.get(m.assignmentId);
    if (qualId != null) result.set(qualId, (result.get(qualId) ?? 0) + 1);
  }
  return result;
}

/** 批次取得多個案件的子表維度（消除 N+1） */
export async function getCaseDimensionsBatch(caseIds: number[]): Promise<
  Map<
    number,
    {
      qualCount: number;
      demandCount: number;
      assignmentCount: number;
      memberCount: number;
    }
  >
> {
  const empty = {
    qualCount: 0,
    demandCount: 0,
    assignmentCount: 0,
    memberCount: 0,
  };
  const result = new Map(caseIds.map(id => [id, { ...empty }]));
  if (caseIds.length === 0) return result;
  const db = await getDb();
  if (!db) return result;
  const [quals, demands, assignments] = await Promise.all([
    db
      .select({ caseId: caseQualifications.caseId })
      .from(caseQualifications)
      .where(inArray(caseQualifications.caseId, caseIds)),
    db
      .select({ caseId: caseDemands.caseId })
      .from(caseDemands)
      .where(inArray(caseDemands.caseId, caseIds)),
    db
      .select({ id: caseAssignments.id, caseId: caseAssignments.caseId })
      .from(caseAssignments)
      .where(inArray(caseAssignments.caseId, caseIds)),
  ]);
  for (const q of quals) {
    const r = result.get(q.caseId);
    if (r) r.qualCount++;
  }
  for (const d of demands) {
    const r = result.get(d.caseId);
    if (r) r.demandCount++;
  }
  for (const a of assignments) {
    const r = result.get(a.caseId);
    if (r) r.assignmentCount++;
  }
  if (assignments.length > 0) {
    const assignmentIds = assignments.map(a => a.id);
    const members = await db
      .select({ assignmentId: caseAssignmentWorkers.assignmentId })
      .from(caseAssignmentWorkers)
      .where(inArray(caseAssignmentWorkers.assignmentId, assignmentIds));
    const assignmentToCaseId = new Map(assignments.map(a => [a.id, a.caseId]));
    for (const m of members) {
      const caseId = assignmentToCaseId.get(m.assignmentId);
      if (caseId != null) {
        const r = result.get(caseId);
        if (r) r.memberCount++;
      }
    }
  }
  return result;
}

// ─── Case Demands（需求）────────────────────────────────────────────────────
export async function getDemandsByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(caseDemands)
    .where(eq(caseDemands.caseId, caseId))
    .orderBy(caseDemands.id);
}

export async function getDemandById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(caseDemands)
    .where(eq(caseDemands.id, id))
    .limit(1);
  return result[0];
}

export async function createDemand(data: InsertCaseDemand): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(caseDemands).values(data));
}

export async function updateDemand(
  id: number,
  data: Partial<InsertCaseDemand>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(caseDemands).set(data).where(eq(caseDemands.id, id));
}

export async function deleteDemand(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // 解除配對的 demandId 連結（不刪配對）
  await db
    .update(caseAssignments)
    .set({ demandId: null })
    .where(eq(caseAssignments.demandId, id));
  return db.delete(caseDemands).where(eq(caseDemands.id, id));
}

/** 計算需求的 matchedCount（confirmed 以上成員數）與 employedCount */
export async function getDemandProgress(
  demandId: number
): Promise<{ matchedCount: number; employedCount: number }> {
  const db = await getDb();
  if (!db) return { matchedCount: 0, employedCount: 0 };
  const assignmentRows = await db
    .select({ id: caseAssignments.id })
    .from(caseAssignments)
    .where(eq(caseAssignments.demandId, demandId));
  if (assignmentRows.length === 0) return { matchedCount: 0, employedCount: 0 };
  let matchedCount = 0;
  let employedCount = 0;
  for (const a of assignmentRows) {
    const members = await db
      .select()
      .from(caseAssignmentWorkers)
      .where(eq(caseAssignmentWorkers.assignmentId, a.id));
    for (const m of members) {
      if (["confirmed", "upcoming", "employed"].includes(m.stage))
        matchedCount++;
      if (m.stage === "employed") employedCount++;
    }
  }
  return { matchedCount, employedCount };
}

/** 批次計算多筆需求的進度（消除 N+1）：總計 2 次查詢 */
export async function getDemandProgressBatch(
  demandIds: number[]
): Promise<Map<number, { matchedCount: number; employedCount: number }>> {
  const result = new Map<
    number,
    { matchedCount: number; employedCount: number }
  >(demandIds.map(id => [id, { matchedCount: 0, employedCount: 0 }]));
  if (demandIds.length === 0) return result;
  const db = await getDb();
  if (!db) return result;
  const assignmentRows = await db
    .select({ id: caseAssignments.id, demandId: caseAssignments.demandId })
    .from(caseAssignments)
    .where(inArray(caseAssignments.demandId, demandIds));
  if (assignmentRows.length === 0) return result;
  const assignmentIds = assignmentRows.map(a => a.id);
  const assignmentToDemand = new Map(
    assignmentRows.map(a => [a.id, a.demandId!])
  );
  const members = await db
    .select({
      assignmentId: caseAssignmentWorkers.assignmentId,
      stage: caseAssignmentWorkers.stage,
    })
    .from(caseAssignmentWorkers)
    .where(inArray(caseAssignmentWorkers.assignmentId, assignmentIds));
  for (const m of members) {
    const demandId = assignmentToDemand.get(m.assignmentId);
    if (demandId == null) continue;
    const r = result.get(demandId);
    if (!r) continue;
    if (["confirmed", "upcoming", "employed"].includes(m.stage))
      r.matchedCount++;
    if (m.stage === "employed") r.employedCount++;
  }
  return result;
}

// ─── Case Assignments（配對）────────────────────────────────────────────────
export async function getAssignmentsByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(caseAssignments)
    .where(eq(caseAssignments.caseId, caseId))
    .orderBy(caseAssignments.id);
}

export async function getAssignmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(caseAssignments)
    .where(eq(caseAssignments.id, id))
    .limit(1);
  return result[0];
}

export async function createAssignment(
  data: InsertCaseAssignment
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(caseAssignments).values(data));
}

export async function updateAssignment(
  id: number,
  data: Partial<InsertCaseAssignment>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(caseAssignments).set(data).where(eq(caseAssignments.id, id));
}

export async function deleteAssignment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .delete(caseAssignmentWorkers)
    .where(eq(caseAssignmentWorkers.assignmentId, id));
  return db.delete(caseAssignments).where(eq(caseAssignments.id, id));
}

// ─── Case Assignment Workers（配對成員）─────────────────────────────────────
export async function getMembersByAssignmentId(assignmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(caseAssignmentWorkers)
    .where(eq(caseAssignmentWorkers.assignmentId, assignmentId))
    .orderBy(caseAssignmentWorkers.id);
}

export async function getMembersByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(caseAssignmentWorkers)
    .where(eq(caseAssignmentWorkers.caseId, caseId))
    .orderBy(caseAssignmentWorkers.id);
}

export async function getMemberById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(caseAssignmentWorkers)
    .where(eq(caseAssignmentWorkers.id, id))
    .limit(1);
  return result[0];
}

export async function createMember(
  data: InsertCaseAssignmentWorker
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(caseAssignmentWorkers).values(data));
}

export async function updateMember(
  id: number,
  data: Partial<InsertCaseAssignmentWorker>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .update(caseAssignmentWorkers)
    .set(data)
    .where(eq(caseAssignmentWorkers.id, id));
}

export async function deleteMember(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .delete(caseAssignmentWorkers)
    .where(eq(caseAssignmentWorkers.id, id));
}

/** 取得移工在其他案件的進行中參與（用於跨案件提醒） */
export async function getWorkerInvolvements(excludeCaseId?: number) {
  const db = await getDb();
  if (!db) return [];
  const activeStages = ["candidate", "confirmed", "upcoming", "employed"];
  const allMembers = await db.select().from(caseAssignmentWorkers);
  const activeMembers = allMembers.filter(
    m =>
      activeStages.includes(m.stage) &&
      (excludeCaseId === undefined || m.caseId !== excludeCaseId)
  );
  return activeMembers;
}

/** 計算案件三維度進度（資格維度、媒合維度、聘僱維度）與 suggestedComplete */
export async function getCaseDimensions(caseId: number) {
  const db = await getDb();
  if (!db)
    return {
      qualReady: false,
      matchReady: false,
      hireReady: false,
      suggestedComplete: false,
    };

  const [quals, demands, assignments] = await Promise.all([
    db
      .select()
      .from(caseQualifications)
      .where(eq(caseQualifications.caseId, caseId)),
    db.select().from(caseDemands).where(eq(caseDemands.caseId, caseId)),
    db.select().from(caseAssignments).where(eq(caseAssignments.caseId, caseId)),
  ]);

  // 資格維度：至少一筆資格，且所有資格 applicationStatus = approved
  const qualReady =
    quals.length > 0 && quals.every(q => q.applicationStatus === "approved");

  // 媒合維度：至少一筆需求，且所有需求 status = fulfilled
  const matchReady =
    demands.length > 0 && demands.every(d => d.status === "fulfilled");

  // 聘僱維度：至少一筆配對成員 stage = employed
  const allMembers = await db
    .select()
    .from(caseAssignmentWorkers)
    .where(eq(caseAssignmentWorkers.caseId, caseId));
  const hireReady = allMembers.some(m => m.stage === "employed");

  const suggestedComplete = qualReady && matchReady && hireReady;
  return { qualReady, matchReady, hireReady, suggestedComplete };
}

// ─── Case Employments ─────────────────────────────────────────────────────────
export async function getEmploymentsByCase(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(caseEmployments)
    .where(eq(caseEmployments.caseId, caseId));
}
export async function createEmployment(
  data: InsertCaseEmployment
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(caseEmployments).values(data));
}
export async function updateEmployment(
  id: number,
  data: Partial<InsertCaseEmployment>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(caseEmployments).set(data).where(eq(caseEmployments.id, id));
}
export async function deleteEmployment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(caseEmployments).where(eq(caseEmployments.id, id));
}

// ─── Customer Care Receivers（被照顧者）──────────────────────────────────────
export async function getCareReceiversByCustomerId(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(customerCareReceivers)
    .where(eq(customerCareReceivers.customerId, customerId));
}
export async function createCareReceiver(
  data: InsertCustomerCareReceiver
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(customerCareReceivers).values(data));
}
export async function updateCareReceiver(
  id: number,
  data: Partial<InsertCustomerCareReceiver>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(customerCareReceivers)
    .set(data)
    .where(eq(customerCareReceivers.id, id));
}
export async function deleteCareReceiver(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .delete(customerCareReceivers)
    .where(eq(customerCareReceivers.id, id));
}

// ─── Customer Qualifications（申請資格）──────────────────────────────────────
export async function getQualificationsByCustomerId(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(customerQualifications)
    .where(eq(customerQualifications.customerId, customerId));
}
export async function createCustomerQualification(
  data: InsertCustomerQualification
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(customerQualifications).values(data));
}
export async function updateCustomerQualification(
  id: number,
  data: Partial<InsertCustomerQualification>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(customerQualifications)
    .set(data)
    .where(eq(customerQualifications.id, id));
}
export async function deleteCustomerQualification(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .delete(customerQualifications)
    .where(eq(customerQualifications.id, id));
}

// ─── Dashboard 聚合（將計數下推至 SQL，避免全表載入到記憶體）──────────────────

type CountRow = { value: string | null; count: number };

const toCountRows = (
  rows: { value: string | null; count: unknown }[]
): CountRow[] => rows.map(r => ({ value: r.value, count: Number(r.count) }));

/** 各維度的分組計數 + 總數，全部以 SQL GROUP BY / COUNT 完成。 */
export async function getDashboardCounts() {
  const db = await getDb();
  if (!db) {
    return {
      totals: { workers: 0, customers: 0, cases: 0 },
      workersByLifecycle: [] as CountRow[],
      casesByStatus: [] as CountRow[],
      customersByType: [] as CountRow[],
    };
  }

  const [
    workerTotalRow,
    customerTotalRow,
    caseTotalRow,
    lifecycleRows,
    caseStatusRows,
    customerTypeRows,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(workers),
    db.select({ count: sql<number>`count(*)` }).from(customers),
    db.select({ count: sql<number>`count(*)` }).from(cases),
    db
      .select({ value: workers.lifecycleStatus, count: sql<number>`count(*)` })
      .from(workers)
      .groupBy(workers.lifecycleStatus),
    db
      .select({ value: cases.status, count: sql<number>`count(*)` })
      .from(cases)
      .groupBy(cases.status),
    db
      .select({ value: customers.employerType, count: sql<number>`count(*)` })
      .from(customers)
      .groupBy(customers.employerType),
  ]);

  return {
    totals: {
      workers: Number(workerTotalRow[0]?.count ?? 0),
      customers: Number(customerTotalRow[0]?.count ?? 0),
      cases: Number(caseTotalRow[0]?.count ?? 0),
    },
    workersByLifecycle: toCountRows(lifecycleRows),
    casesByStatus: toCountRows(caseStatusRows),
    customersByType: toCountRows(customerTypeRows),
  };
}

/**
 * 取得「未結案且至少一張證件在 cutoffDate（含）之前到期」的移工，只取計算所需欄位。
 * 證件日期以 YYYY-MM-DD 字串儲存，ISO 格式可直接做字典序比較。
 */
export async function getExpiryCandidateWorkers(
  cutoffDate: string,
  closedStatuses: string[]
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: workers.id,
      name: workers.name,
      lifecycleStatus: workers.lifecycleStatus,
      residentPermitExpiry: workers.residentPermitExpiry,
      passportExpiry: workers.passportExpiry,
    })
    .from(workers)
    .where(
      and(
        notInArray(workers.lifecycleStatus, closedStatuses as any),
        or(
          lt(workers.residentPermitExpiry, cutoffDate),
          eq(workers.residentPermitExpiry, cutoffDate),
          lt(workers.passportExpiry, cutoffDate),
          eq(workers.passportExpiry, cutoffDate)
        )
      )
    );
}

/**
 * 取得「法定合規」候選：以案件為單位，串起
 *   案件 → 主要移工（誰）→ 雇主資格（基準日 approvedStartDate / 聘僱許可截止日 approvedEndDate）
 *        → 案件上 6/18/30 個月體檢日（是否已辦）＋ 移工檔體檢日（資料分兩處的退路）。
 * 只取非取消案件、且主要移工未結案（未回國/未逃跑）者。實際到期判定在 shared/healthCheck.ts。
 */
export async function getComplianceCandidates(closedStatuses: string[]) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      caseId: cases.id,
      caseNo: cases.caseNo,
      caseName: cases.name,
      caseStatus: cases.status,
      managerId: cases.managerId,
      managerName: managers.name,
      workerId: cases.primaryWorkerId,
      workerName: workers.name,
      workerNameCn: workers.nameCn,
      workerNameEn: workers.nameEn,
      workerLifecycle: workers.lifecycleStatus,
      // 移工檔另記的體檢日（處理健檢資料分兩處）
      workerLastMedicalExamDate: workers.lastMedicalExamDate,
      // 基準日優先取雇主資格的核准聘僱起始日，退而求其次用案件的接續聘僱日期
      approvedStartDate: customerQualifications.approvedStartDate,
      continuousEmploymentDate: cases.continuousEmploymentDate,
      // 聘僱許可（續聘）到期：核准聘僱截止日；缺值時可由起始日 + 期間月數推算
      approvedEndDate: customerQualifications.approvedEndDate,
      employmentPeriodMonths: cases.employmentPeriodMonths,
      terminationDate: cases.terminationDate,
      // 已登錄的定期體檢日期
      exam6mDate: cases.exam6mDate,
      exam18mDate: cases.exam18mDate,
      exam30mDate: cases.exam30mDate,
    })
    .from(cases)
    .innerJoin(workers, eq(cases.primaryWorkerId, workers.id))
    .leftJoin(managers, eq(cases.managerId, managers.id))
    .leftJoin(
      customerQualifications,
      eq(cases.customerQualificationId, customerQualifications.id)
    )
    .where(
      and(
        ne(cases.status, "cancelled"),
        notInArray(workers.lifecycleStatus, closedStatuses as any)
      )
    );
}

// ─── KPI 每日快照（趨勢比較）──────────────────────────────────────────────────

/** Upsert 當日快照（snapshotDate 為主鍵）。 */
export async function upsertKpiSnapshot(snapshot: InsertKpiSnapshot) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(kpiSnapshots)
    .values(snapshot)
    .onDuplicateKeyUpdate({
      set: {
        workers: snapshot.workers,
        customers: snapshot.customers,
        cases: snapshot.cases,
        employed: snapshot.employed,
        expiringSoon: snapshot.expiringSoon,
        expired: snapshot.expired,
      },
    });
}

/** 取得 beforeDate 之前最近一筆快照，用於計算變化量。 */
export async function getPreviousKpiSnapshot(
  beforeDate: string
): Promise<KpiSnapshot | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(kpiSnapshots)
    .where(lt(kpiSnapshots.snapshotDate, beforeDate))
    .orderBy(desc(kpiSnapshots.snapshotDate))
    .limit(1);
  return rows[0];
}

// ─── Job Postings（公開需求單，P1）────────────────────────────────────────────
export async function createJobPosting(
  data: InsertJobPosting
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(jobPostings).values(data));
}

export async function getJobPostingById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(jobPostings)
    .where(eq(jobPostings.id, id))
    .limit(1);
  return rows[0];
}

export async function getJobPostingsByEmployer(employerUserId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(jobPostings)
    .where(eq(jobPostings.employerUserId, employerUserId))
    .orderBy(desc(jobPostings.createdAt));
}

export async function updateJobPosting(
  id: number,
  data: Partial<InsertJobPosting>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(jobPostings).set(data).where(eq(jobPostings.id, id));
}

/**
 * 原子搶佔：把 pending_review 的需求單標成 approved，回傳是否搶到。
 * 用條件式 UPDATE（WHERE status='pending_review'）當審核的併發保護 ——
 * 兩個 staff 同時按「通過」時只有一個會 affectedRows=1，另一個為 0，
 * 避免重複建立 case。搶到者接著建 case 並回填 caseId。
 */
export async function claimJobPostingForApproval(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const res = await db
    .update(jobPostings)
    .set({ status: "approved" })
    .where(
      and(eq(jobPostings.id, id), eq(jobPostings.status, "pending_review"))
    );
  const affected =
    (res as unknown as { affectedRows?: number }[])[0]?.affectedRows ??
    (res as unknown as { affectedRows?: number }).affectedRows ??
    0;
  return Number(affected) > 0;
}

/** 審核佇列：待審需求單（pending_review），最舊的在前（先到先審）。 */
export async function getPendingJobPostings() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(jobPostings)
    .where(eq(jobPostings.status, "pending_review"))
    .orderBy(jobPostings.createdAt);
}

/** 公開「找工作」：已上架（approved）的需求單。 */
export async function listApprovedJobPostings() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(jobPostings)
    .where(eq(jobPostings.status, "approved"))
    .orderBy(desc(jobPostings.publishedAt));
}

/**
 * 公開「找工作」：既有內部需求單中「尚未媒合成功」且未被隱藏者。
 * 只回傳去識別後的子集（qualType / 人數 / 案件公開縣市），不含任何 PII —— 雇主
 * 姓名、地址、notes 一律不 join、不外露（規格 §11）。
 */
export async function listPublicOpenDemands() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: caseDemands.id,
      caseId: caseDemands.caseId,
      qualType: caseDemands.qualType,
      neededCount: caseDemands.neededCount,
      status: caseDemands.status,
      publicCity: cases.publicCity,
      createdAt: caseDemands.createdAt,
    })
    .from(caseDemands)
    .innerJoin(cases, eq(caseDemands.caseId, cases.id))
    .where(
      and(
        inArray(caseDemands.status, ["open", "filling"]),
        eq(caseDemands.publicHidden, 0)
      )
    )
    .orderBy(desc(caseDemands.createdAt));
}

/** 設定既有需求單是否在公開站隱藏（staff 逐筆控制）。 */
export async function setDemandPublicHidden(demandId: number, hidden: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .update(caseDemands)
    .set({ publicHidden: hidden ? 1 : 0 })
    .where(eq(caseDemands.id, demandId));
}

/** 設定案件的公開顯示縣市（供既有需求單在找工作頁顯示地點）。 */
export async function setCasePublicCity(caseId: number, city: string | null) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(cases).set({ publicCity: city }).where(eq(cases.id, caseId));
}

// ─── Moderation Events（審核稽核，P1）─────────────────────────────────────────
export async function insertModerationEvent(
  data: InsertModerationEvent
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(moderationEvents).values(data);
  } catch (error) {
    console.error("[moderation] 稽核事件寫入失敗（不影響主流程）：", error);
  }
}

// ─── Match Requests（媒合意向，P3）────────────────────────────────────────────
export async function createMatchRequest(
  data: InsertMatchRequest
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(matchRequests).values(data));
}

/**
 * 找同一發起者對同一標的「仍在進行中」的意向（去重用）。
 * 已成交/已關閉者不算，允許重新表達興趣。
 */
export async function getOpenMatchRequest(
  initiatorUserId: number,
  targetType: "job_posting" | "case_demand" | "worker",
  targetId: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(matchRequests)
    .where(
      and(
        eq(matchRequests.initiatorUserId, initiatorUserId),
        eq(matchRequests.targetType, targetType),
        eq(matchRequests.targetId, targetId),
        notInArray(matchRequests.status, ["matched", "closed"])
      )
    )
    .limit(1);
  return rows[0];
}

/** 客服媒合意向佇列（可依狀態過濾；狀態條件下推 SQL 走索引）。 */
export async function getAllMatchRequests(
  status?: "new" | "staff_handling" | "introduced" | "matched" | "closed"
) {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(matchRequests);
  const rows = status
    ? await q
        .where(eq(matchRequests.status, status))
        .orderBy(desc(matchRequests.createdAt))
    : await q.orderBy(desc(matchRequests.createdAt));
  return rows;
}

export async function getMatchRequestById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(matchRequests)
    .where(eq(matchRequests.id, id))
    .limit(1);
  return rows[0];
}

export async function updateMatchRequest(
  id: number,
  data: Partial<InsertMatchRequest>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(matchRequests).set(data).where(eq(matchRequests.id, id));
}

/** 發起者自己送出過的意向（「我的意向」）。 */
export async function getMatchRequestsByInitiator(initiatorUserId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(matchRequests)
    .where(eq(matchRequests.initiatorUserId, initiatorUserId))
    .orderBy(desc(matchRequests.createdAt));
}

// ─── Worker Public Profiles（移工公開履歷，P2）────────────────────────────────
export async function getProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(workerPublicProfiles)
    .where(eq(workerPublicProfiles.userId, userId))
    .limit(1);
  return rows[0];
}

export async function getProfileById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(workerPublicProfiles)
    .where(eq(workerPublicProfiles.id, id))
    .limit(1);
  return rows[0];
}

export async function createProfile(
  data: InsertWorkerPublicProfile
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(workerPublicProfiles).values(data));
}

export async function updateProfile(
  id: number,
  data: Partial<InsertWorkerPublicProfile>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .update(workerPublicProfiles)
    .set(data)
    .where(eq(workerPublicProfiles.id, id));
}

/** 客服勾稽：所有移工公開履歷（不論狀態），最新在前。 */
export async function getAllProfiles() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workerPublicProfiles)
    .orderBy(desc(workerPublicProfiles.createdAt));
}

/** 客服勾稽：以姓名/中英文名/居留證/護照號模糊搜尋既有名冊，供連結自助帳號。 */
export async function searchWorkersForReconcile(query: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const q = `%${query}%`;
  return db
    .select({
      id: workers.id,
      name: workers.name,
      nameCn: workers.nameCn,
      nameEn: workers.nameEn,
      nationality: workers.nationality,
      residentPermitNo: workers.residentPermitNo,
      passportNo: workers.passportNo,
    })
    .from(workers)
    .where(
      or(
        like(workers.name, q),
        like(workers.nameCn, q),
        like(workers.nameEn, q),
        like(workers.residentPermitNo, q),
        like(workers.passportNo, q)
      )
    )
    .limit(limit);
}

/** 客服勾稽：連結（或解除）公開履歷 ↔ 既有名冊 workers.id。 */
export async function setProfileWorkerLink(
  profileId: number,
  workerId: number | null
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .update(workerPublicProfiles)
    .set({ workerId })
    .where(eq(workerPublicProfiles.id, profileId));
}

/** 客服審核佇列：待審履歷。只列「想公開（published）且待審」者，草稿不入列。 */
export async function getPendingProfiles() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workerPublicProfiles)
    .where(
      and(
        eq(workerPublicProfiles.publishStatus, "published"),
        eq(workerPublicProfiles.moderationStatus, "pending")
      )
    )
    .orderBy(workerPublicProfiles.createdAt);
}

/** 找移工：已公開且審核通過的匿名履歷（可依職類/國籍過濾）。 */
export async function listPublicProfiles(filters?: {
  jobType?: string;
  nationality?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(workerPublicProfiles)
    .where(
      and(
        eq(workerPublicProfiles.publishStatus, "published"),
        eq(workerPublicProfiles.moderationStatus, "approved")
      )
    )
    .orderBy(desc(workerPublicProfiles.updatedAt));
  return rows.filter(r => {
    if (filters?.jobType) {
      // 多選職類：jobTypes 陣列含篩選值即命中；無 jobTypes 的舊列回退比對 jobType。
      let types: string[] = [];
      try {
        types = r.jobTypes ? (JSON.parse(r.jobTypes) as string[]) : [];
      } catch {
        types = [];
      }
      if (types.length === 0 && r.jobType) types = [r.jobType];
      if (!types.includes(filters.jobType)) return false;
    }
    if (filters?.nationality && r.nationality !== filters.nationality)
      return false;
    return true;
  });
}

// ─── Worker Experiences（自填經歷，P2）────────────────────────────────────────
export async function getExperiencesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workerExperiences)
    .where(eq(workerExperiences.userId, userId))
    .orderBy(desc(workerExperiences.startDate));
}

/** 找移工詳情用：某使用者「已審核通過」的自填經歷。 */
export async function getApprovedExperiencesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workerExperiences)
    .where(
      and(
        eq(workerExperiences.userId, userId),
        eq(workerExperiences.reviewStatus, "approved")
      )
    )
    .orderBy(desc(workerExperiences.startDate));
}

export async function getExperienceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(workerExperiences)
    .where(eq(workerExperiences.id, id))
    .limit(1);
  return rows[0];
}

export async function createExperience(
  data: InsertWorkerExperience
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(workerExperiences).values(data));
}

export async function updateExperience(
  id: number,
  data: Partial<InsertWorkerExperience>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .update(workerExperiences)
    .set(data)
    .where(eq(workerExperiences.id, id));
}

export async function deleteExperience(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(workerExperiences).where(eq(workerExperiences.id, id));
}

/** 客服審核佇列：待審自填經歷。 */
export async function getPendingExperiences() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workerExperiences)
    .where(eq(workerExperiences.reviewStatus, "pending"))
    .orderBy(workerExperiences.createdAt);
}

/** 平台可信工作紀錄：某 workers.id 的僱傭紀錄（去識別：職務/期間/狀態）。 */
export async function getEmploymentsByWorker(workerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: caseEmployments.id,
      position: caseEmployments.position,
      contractStart: caseEmployments.contractStart,
      contractEnd: caseEmployments.contractEnd,
      status: caseEmployments.status,
    })
    .from(caseEmployments)
    .where(eq(caseEmployments.workerId, workerId))
    .orderBy(desc(caseEmployments.contractStart));
}

/** 找移工 gating：雇主帳號名下已通過（approved）的需求單數。 */
export async function countApprovedPostingsByEmployer(
  employerUserId: number
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobPostings)
    .where(
      and(
        eq(jobPostings.employerUserId, employerUserId),
        eq(jobPostings.status, "approved")
      )
    );
  return Number(rows[0]?.count ?? 0);
}

// ─── Ratings（評分：只限已完成聘僱，P3）───────────────────────────────────────
/** 取單筆聘僱（供評分完成判定與授權）。 */
export async function getEmploymentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(caseEmployments)
    .where(eq(caseEmployments.id, id))
    .limit(1);
  return rows[0];
}

/** 某聘僱是否已有評分（一段聘僱一則）。 */
export async function getRatingByEmployment(employmentId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(ratings)
    .where(eq(ratings.employmentId, employmentId))
    .limit(1);
  return rows[0];
}

/** 建立評分。 */
export async function createRating(data: InsertRating): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(ratings).values(data));
}

/** 某 workers.id 的評分清單（去識別：不含評分者身分）。 */
export async function getRatingsByWorker(workerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: ratings.id,
      score: ratings.score,
      comment: ratings.comment,
      createdAt: ratings.createdAt,
    })
    .from(ratings)
    .where(eq(ratings.workerId, workerId))
    .orderBy(desc(ratings.createdAt));
}

/** 依 workers.id 找連結的公開履歷（客服勾稽後 workerId 相符；一般 ≤1 筆）。 */
export async function getProfilesByWorkerId(workerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workerPublicProfiles)
    .where(eq(workerPublicProfiles.workerId, workerId));
}

/**
 * 依評分清單重算某 worker 的聚合，寫回其連結的公開履歷。
 * ratingAvg 存平均×10 的整數（沿用既有慣例，避免浮點）；無連結履歷則不寫。
 */
export async function recomputeWorkerRating(workerId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const rows = await db
    .select({ score: ratings.score })
    .from(ratings)
    .where(eq(ratings.workerId, workerId));
  const count = rows.length;
  const avgTimes10 = count
    ? Math.round((rows.reduce((s, r) => s + r.score, 0) / count) * 10)
    : 0;
  await db
    .update(workerPublicProfiles)
    .set({ ratingAvg: avgTimes10, ratingCount: count })
    .where(eq(workerPublicProfiles.workerId, workerId));
}

// ─── OAuth Identities（社群登入 ↔ 本地帳號）────────────────────────────────────
/** 依 (provider, providerUserId) 找已連結的社群身分。 */
export async function getOAuthIdentity(
  provider: string,
  providerUserId: string
) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(oauthIdentities)
    .where(
      and(
        eq(oauthIdentities.provider, provider),
        eq(oauthIdentities.providerUserId, providerUserId)
      )
    )
    .limit(1);
  return rows[0];
}

/** 建立社群身分連結（把某 provider 身分綁到某本地 users.id）。 */
export async function insertOAuthIdentity(
  data: InsertOAuthIdentity
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(oauthIdentities).values(data));
}

// ─── Phone OTP / 手機號帳號（WhatsApp 登入）──────────────────────────────────
/** 依手機號查使用者（WhatsApp OTP 登入用）。 */
export async function getUserByPhone(phone: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);
  return rows[0];
}

/** 標記某帳號手機已驗證。 */
export async function markPhoneVerified(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ phoneVerified: 1 }).where(eq(users.id, userId));
}

/** 清掉某手機號的舊 OTP（發新碼前呼叫，維持單一有效碼）。 */
export async function deletePhoneOtps(phone: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(phoneOtps).where(eq(phoneOtps.phone, phone));
}

/** 建立一筆 OTP。 */
export async function createPhoneOtp(data: InsertPhoneOtp): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return insertedId(await db.insert(phoneOtps).values(data));
}

/** 取某手機號最新一筆 OTP（驗證時用；到期/嘗試次數在呼叫端判斷）。 */
export async function getLatestPhoneOtp(phone: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(phoneOtps)
    .where(eq(phoneOtps.phone, phone))
    .orderBy(desc(phoneOtps.createdAt))
    .limit(1);
  return rows[0];
}

/** 驗證失敗：累加嘗試次數。 */
export async function bumpPhoneOtpAttempts(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(phoneOtps)
    .set({ attempts: sql`${phoneOtps.attempts} + 1` })
    .where(eq(phoneOtps.id, id));
}

/** 驗證成功：標記已用（防重放）。 */
export async function consumePhoneOtp(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(phoneOtps)
    .set({ consumedAt: new Date() })
    .where(eq(phoneOtps.id, id));
}
