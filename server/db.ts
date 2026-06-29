import { and, desc, eq, inArray, lt, ne, notInArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, managers, workers, customers, InsertManager, InsertWorker, InsertCustomer, cases, caseQualifications, caseDemands, caseAssignments, caseAssignmentWorkers, caseEmployments, InsertCase, InsertCaseQualification, InsertCaseDemand, InsertCaseAssignment, InsertCaseAssignmentWorker, InsertCaseEmployment, customerCareReceivers, customerQualifications, InsertCustomerCareReceiver, InsertCustomerQualification, kpiSnapshots, InsertKpiSnapshot, KpiSnapshot } from "../drizzle/schema";
import { ENV } from './_core/env';

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
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
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
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Managers ────────────────────────────────────────────────────────────────
export async function getAllManagers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(managers).orderBy(managers.id);
}

export async function createManager(data: InsertManager) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(managers).values(data);
}

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
  const result = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  return result[0];
}

/** 依居留證號查重（排除自身） */
export async function getWorkerByPermitNo(permitNo: string, excludeId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const conditions = excludeId
    ? and(eq(workers.residentPermitNo, permitNo), ne(workers.id, excludeId))
    : eq(workers.residentPermitNo, permitNo);
  const result = await db.select().from(workers).where(conditions).limit(1);
  return result[0];
}

/** 依護照號查重（排除自身） */
export async function getWorkerByPassportNo(passportNo: string, excludeId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const conditions = excludeId
    ? and(eq(workers.passportNo, passportNo), ne(workers.id, excludeId))
    : eq(workers.passportNo, passportNo);
  const result = await db.select().from(workers).where(conditions).limit(1);
  return result[0];
}

/** 相容舊版：依任一證號查重 */
export async function getWorkerByIdNumber(idNumber: string, excludeId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const permitResult = await getWorkerByPermitNo(idNumber, excludeId);
  if (permitResult) return permitResult;
  return getWorkerByPassportNo(idNumber, excludeId);
}

export async function createWorker(data: InsertWorker): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(workers).values(data);
  // MySQL insertId
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  return Number(insertId);
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
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
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

export async function createCustomer(data: InsertCustomer) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(customers).values(data);
}

export async function updateCustomer(id: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(customers).set(data).where(eq(customers.id, id));
}

export async function deleteCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(customers).where(eq(customers.id, id));
}

// ─── Cases（案件）────────────────────────────────────────────────────────────
export async function getAllCases(filters?: { customerId?: number; status?: string; managerId?: number; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(cases).orderBy(cases.createdAt);
  let result = rows;
  if (filters?.customerId) result = result.filter(c => c.customerId === filters.customerId);
  if (filters?.status) result = result.filter(c => c.status === filters.status);
  if (filters?.managerId) result = result.filter(c => c.managerId === filters.managerId);
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

export async function createCase(data: InsertCase) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(cases).values(data);
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
  const assignments = await db.select({ id: caseAssignments.id }).from(caseAssignments).where(eq(caseAssignments.caseId, id));
  for (const a of assignments) {
    await db.delete(caseAssignmentWorkers).where(eq(caseAssignmentWorkers.assignmentId, a.id));
  }
  await db.delete(caseAssignments).where(eq(caseAssignments.caseId, id));
  await db.delete(caseDemands).where(eq(caseDemands.caseId, id));
  await db.delete(caseQualifications).where(eq(caseQualifications.caseId, id));
  return db.delete(cases).where(eq(cases.id, id));
}

/** 計算案件底下各子資料的數量（用於刪除前提示） */
export async function getCaseChildCounts(caseId: number) {
  const db = await getDb();
  if (!db) return { qualCount: 0, demandCount: 0, assignmentCount: 0, memberCount: 0 };
  const [quals, demands, assignments] = await Promise.all([
    db.select().from(caseQualifications).where(eq(caseQualifications.caseId, caseId)),
    db.select().from(caseDemands).where(eq(caseDemands.caseId, caseId)),
    db.select().from(caseAssignments).where(eq(caseAssignments.caseId, caseId)),
  ]);
  let memberCount = 0;
  for (const a of assignments) {
    const members = await db.select().from(caseAssignmentWorkers).where(eq(caseAssignmentWorkers.assignmentId, a.id));
    memberCount += members.length;
  }
  return { qualCount: quals.length, demandCount: demands.length, assignmentCount: assignments.length, memberCount };
}

// ─── Case Qualifications（資格）─────────────────────────────────────────────
export async function getQualificationsByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(caseQualifications).where(eq(caseQualifications.caseId, caseId)).orderBy(caseQualifications.id);
}

export async function getQualificationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(caseQualifications).where(eq(caseQualifications.id, id)).limit(1);
  return result[0];
}

export async function createQualification(data: InsertCaseQualification) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(caseQualifications).values(data);
}

export async function updateQualification(id: number, data: Partial<InsertCaseQualification>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(caseQualifications).set(data).where(eq(caseQualifications.id, id));
}

export async function deleteQualification(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // 解除配對的 qualificationId 連結（不刪配對）
  await db.update(caseAssignments).set({ qualificationId: null }).where(eq(caseAssignments.qualificationId, id));
  return db.delete(caseQualifications).where(eq(caseQualifications.id, id));
}

/** 計算資格的 quotaUsed（employed 成員數） */
export async function getQuotaUsed(qualificationId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const assignmentRows = await db.select({ id: caseAssignments.id }).from(caseAssignments).where(eq(caseAssignments.qualificationId, qualificationId));
  if (assignmentRows.length === 0) return 0;
  const assignmentIds = assignmentRows.map(a => a.id);
  const members = await db.select().from(caseAssignmentWorkers)
    .where(and(inArray(caseAssignmentWorkers.assignmentId, assignmentIds), eq(caseAssignmentWorkers.stage, 'employed')));
  return members.length;
}

/** 批次計算多個資格的 quotaUsed（消除 N+1） */
export async function getQuotaUsedBatch(qualificationIds: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>(qualificationIds.map(id => [id, 0]));
  if (qualificationIds.length === 0) return result;
  const db = await getDb();
  if (!db) return result;
  const assignmentRows = await db.select({ id: caseAssignments.id, qualificationId: caseAssignments.qualificationId })
    .from(caseAssignments).where(inArray(caseAssignments.qualificationId, qualificationIds));
  if (assignmentRows.length === 0) return result;
  const assignmentIds = assignmentRows.map(a => a.id);
  const members = await db.select({ assignmentId: caseAssignmentWorkers.assignmentId })
    .from(caseAssignmentWorkers)
    .where(and(inArray(caseAssignmentWorkers.assignmentId, assignmentIds), eq(caseAssignmentWorkers.stage, 'employed')));
  // 將 assignmentId 對映回 qualificationId
  const assignmentToQual = new Map(assignmentRows.map(a => [a.id, a.qualificationId!]));
  for (const m of members) {
    const qualId = assignmentToQual.get(m.assignmentId);
    if (qualId != null) result.set(qualId, (result.get(qualId) ?? 0) + 1);
  }
  return result;
}

/** 批次取得多個案件的子表維度（消除 N+1） */
export async function getCaseDimensionsBatch(caseIds: number[]): Promise<Map<number, { qualCount: number; demandCount: number; assignmentCount: number; memberCount: number }>> {
  const empty = { qualCount: 0, demandCount: 0, assignmentCount: 0, memberCount: 0 };
  const result = new Map(caseIds.map(id => [id, { ...empty }]));
  if (caseIds.length === 0) return result;
  const db = await getDb();
  if (!db) return result;
  const [quals, demands, assignments] = await Promise.all([
    db.select({ caseId: caseQualifications.caseId }).from(caseQualifications).where(inArray(caseQualifications.caseId, caseIds)),
    db.select({ caseId: caseDemands.caseId }).from(caseDemands).where(inArray(caseDemands.caseId, caseIds)),
    db.select({ id: caseAssignments.id, caseId: caseAssignments.caseId }).from(caseAssignments).where(inArray(caseAssignments.caseId, caseIds)),
  ]);
  for (const q of quals) { const r = result.get(q.caseId); if (r) r.qualCount++; }
  for (const d of demands) { const r = result.get(d.caseId); if (r) r.demandCount++; }
  for (const a of assignments) { const r = result.get(a.caseId); if (r) r.assignmentCount++; }
  if (assignments.length > 0) {
    const assignmentIds = assignments.map(a => a.id);
    const members = await db.select({ assignmentId: caseAssignmentWorkers.assignmentId })
      .from(caseAssignmentWorkers).where(inArray(caseAssignmentWorkers.assignmentId, assignmentIds));
    const assignmentToCaseId = new Map(assignments.map(a => [a.id, a.caseId]));
    for (const m of members) {
      const caseId = assignmentToCaseId.get(m.assignmentId);
      if (caseId != null) { const r = result.get(caseId); if (r) r.memberCount++; }
    }
  }
  return result;
}

// ─── Case Demands（需求）────────────────────────────────────────────────────
export async function getDemandsByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(caseDemands).where(eq(caseDemands.caseId, caseId)).orderBy(caseDemands.id);
}

export async function getDemandById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(caseDemands).where(eq(caseDemands.id, id)).limit(1);
  return result[0];
}

export async function createDemand(data: InsertCaseDemand) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(caseDemands).values(data);
}

export async function updateDemand(id: number, data: Partial<InsertCaseDemand>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(caseDemands).set(data).where(eq(caseDemands.id, id));
}

export async function deleteDemand(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // 解除配對的 demandId 連結（不刪配對）
  await db.update(caseAssignments).set({ demandId: null }).where(eq(caseAssignments.demandId, id));
  return db.delete(caseDemands).where(eq(caseDemands.id, id));
}

/** 計算需求的 matchedCount（confirmed 以上成員數）與 employedCount */
export async function getDemandProgress(demandId: number): Promise<{ matchedCount: number; employedCount: number }> {
  const db = await getDb();
  if (!db) return { matchedCount: 0, employedCount: 0 };
  const assignmentRows = await db.select({ id: caseAssignments.id }).from(caseAssignments).where(eq(caseAssignments.demandId, demandId));
  if (assignmentRows.length === 0) return { matchedCount: 0, employedCount: 0 };
  let matchedCount = 0;
  let employedCount = 0;
  for (const a of assignmentRows) {
    const members = await db.select().from(caseAssignmentWorkers).where(eq(caseAssignmentWorkers.assignmentId, a.id));
    for (const m of members) {
      if (['confirmed', 'upcoming', 'employed'].includes(m.stage)) matchedCount++;
      if (m.stage === 'employed') employedCount++;
    }
  }
  return { matchedCount, employedCount };
}

/** 批次計算多筆需求的進度（消除 N+1）：總計 2 次查詢 */
export async function getDemandProgressBatch(demandIds: number[]): Promise<Map<number, { matchedCount: number; employedCount: number }>> {
  const result = new Map<number, { matchedCount: number; employedCount: number }>(
    demandIds.map(id => [id, { matchedCount: 0, employedCount: 0 }])
  );
  if (demandIds.length === 0) return result;
  const db = await getDb();
  if (!db) return result;
  const assignmentRows = await db.select({ id: caseAssignments.id, demandId: caseAssignments.demandId })
    .from(caseAssignments).where(inArray(caseAssignments.demandId, demandIds));
  if (assignmentRows.length === 0) return result;
  const assignmentIds = assignmentRows.map(a => a.id);
  const assignmentToDemand = new Map(assignmentRows.map(a => [a.id, a.demandId!]));
  const members = await db.select({ assignmentId: caseAssignmentWorkers.assignmentId, stage: caseAssignmentWorkers.stage })
    .from(caseAssignmentWorkers).where(inArray(caseAssignmentWorkers.assignmentId, assignmentIds));
  for (const m of members) {
    const demandId = assignmentToDemand.get(m.assignmentId);
    if (demandId == null) continue;
    const r = result.get(demandId);
    if (!r) continue;
    if (['confirmed', 'upcoming', 'employed'].includes(m.stage)) r.matchedCount++;
    if (m.stage === 'employed') r.employedCount++;
  }
  return result;
}

// ─── Case Assignments（配對）────────────────────────────────────────────────
export async function getAssignmentsByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(caseAssignments).where(eq(caseAssignments.caseId, caseId)).orderBy(caseAssignments.id);
}

export async function getAssignmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(caseAssignments).where(eq(caseAssignments.id, id)).limit(1);
  return result[0];
}

export async function createAssignment(data: InsertCaseAssignment): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(caseAssignments).values(data);
  // drizzle mysql2 回傳 [ResultSetHeader, FieldPacket[]]，insertId 在 result[0]
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  return Number(insertId);
}

export async function updateAssignment(id: number, data: Partial<InsertCaseAssignment>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(caseAssignments).set(data).where(eq(caseAssignments.id, id));
}

export async function deleteAssignment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(caseAssignmentWorkers).where(eq(caseAssignmentWorkers.assignmentId, id));
  return db.delete(caseAssignments).where(eq(caseAssignments.id, id));
}

// ─── Case Assignment Workers（配對成員）─────────────────────────────────────
export async function getMembersByAssignmentId(assignmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(caseAssignmentWorkers).where(eq(caseAssignmentWorkers.assignmentId, assignmentId)).orderBy(caseAssignmentWorkers.id);
}

export async function getMembersByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(caseAssignmentWorkers).where(eq(caseAssignmentWorkers.caseId, caseId)).orderBy(caseAssignmentWorkers.id);
}

export async function getMemberById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(caseAssignmentWorkers).where(eq(caseAssignmentWorkers.id, id)).limit(1);
  return result[0];
}

export async function createMember(data: InsertCaseAssignmentWorker) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(caseAssignmentWorkers).values(data);
}

export async function updateMember(id: number, data: Partial<InsertCaseAssignmentWorker>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(caseAssignmentWorkers).set(data).where(eq(caseAssignmentWorkers.id, id));
}

export async function deleteMember(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(caseAssignmentWorkers).where(eq(caseAssignmentWorkers.id, id));
}

/** 取得移工在其他案件的進行中參與（用於跨案件提醒） */
export async function getWorkerInvolvements(excludeCaseId?: number) {
  const db = await getDb();
  if (!db) return [];
  const activeStages = ['candidate', 'confirmed', 'upcoming', 'employed'];
  const allMembers = await db.select().from(caseAssignmentWorkers);
  const activeMembers = allMembers.filter(m =>
    activeStages.includes(m.stage) &&
    (excludeCaseId === undefined || m.caseId !== excludeCaseId)
  );
  return activeMembers;
}

/** 計算案件三維度進度（資格維度、媒合維度、聘僱維度）與 suggestedComplete */
export async function getCaseDimensions(caseId: number) {
  const db = await getDb();
  if (!db) return { qualReady: false, matchReady: false, hireReady: false, suggestedComplete: false };

  const [quals, demands, assignments] = await Promise.all([
    db.select().from(caseQualifications).where(eq(caseQualifications.caseId, caseId)),
    db.select().from(caseDemands).where(eq(caseDemands.caseId, caseId)),
    db.select().from(caseAssignments).where(eq(caseAssignments.caseId, caseId)),
  ]);

  // 資格維度：至少一筆資格，且所有資格 applicationStatus = approved
  const qualReady = quals.length > 0 && quals.every(q => q.applicationStatus === 'approved');

  // 媒合維度：至少一筆需求，且所有需求 status = fulfilled
  const matchReady = demands.length > 0 && demands.every(d => d.status === 'fulfilled');

  // 聘僱維度：至少一筆配對成員 stage = employed
  const allMembers = await db.select().from(caseAssignmentWorkers).where(eq(caseAssignmentWorkers.caseId, caseId));
  const hireReady = allMembers.some(m => m.stage === 'employed');

  const suggestedComplete = qualReady && matchReady && hireReady;
  return { qualReady, matchReady, hireReady, suggestedComplete };
}

// ─── Case Employments ─────────────────────────────────────────────────────────
export async function getEmploymentsByCase(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(caseEmployments).where(eq(caseEmployments.caseId, caseId));
}
export async function createEmployment(data: InsertCaseEmployment) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(caseEmployments).values(data);
  return result;
}
export async function updateEmployment(id: number, data: Partial<InsertCaseEmployment>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(caseEmployments).set(data).where(eq(caseEmployments.id, id));
}
export async function deleteEmployment(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(caseEmployments).where(eq(caseEmployments.id, id));
}

// ─── Customer Care Receivers（被照顧者）──────────────────────────────────────
export async function getCareReceiversByCustomerId(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customerCareReceivers).where(eq(customerCareReceivers.customerId, customerId));
}
export async function createCareReceiver(data: InsertCustomerCareReceiver) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(customerCareReceivers).values(data);
  return (result as any)[0]?.insertId ?? (result as any).insertId as number;
}
export async function updateCareReceiver(id: number, data: Partial<InsertCustomerCareReceiver>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(customerCareReceivers).set(data).where(eq(customerCareReceivers.id, id));
}
export async function deleteCareReceiver(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(customerCareReceivers).where(eq(customerCareReceivers.id, id));
}

// ─── Customer Qualifications（申請資格）──────────────────────────────────────
export async function getQualificationsByCustomerId(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customerQualifications).where(eq(customerQualifications.customerId, customerId));
}
export async function createCustomerQualification(data: InsertCustomerQualification) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(customerQualifications).values(data);
  return (result as any)[0]?.insertId ?? (result as any).insertId as number;
}
export async function updateCustomerQualification(id: number, data: Partial<InsertCustomerQualification>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(customerQualifications).set(data).where(eq(customerQualifications.id, id));
}
export async function deleteCustomerQualification(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(customerQualifications).where(eq(customerQualifications.id, id));
}

// ─── Dashboard 聚合（將計數下推至 SQL，避免全表載入到記憶體）──────────────────

type CountRow = { value: string | null; count: number };

const toCountRows = (rows: { value: string | null; count: unknown }[]): CountRow[] =>
  rows.map(r => ({ value: r.value, count: Number(r.count) }));

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
export async function getExpiryCandidateWorkers(cutoffDate: string, closedStatuses: string[]) {
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
          eq(workers.passportExpiry, cutoffDate),
        ),
      ),
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
export async function getPreviousKpiSnapshot(beforeDate: string): Promise<KpiSnapshot | undefined> {
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
