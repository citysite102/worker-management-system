import { and, eq, ne, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, managers, workers, customers, InsertManager, InsertWorker, InsertCustomer, cases, caseQualifications, caseDemands, caseAssignments, caseAssignmentWorkers, caseEmployments, InsertCase, InsertCaseQualification, InsertCaseDemand, InsertCaseAssignment, InsertCaseAssignmentWorker, InsertCaseEmployment } from "../drizzle/schema";
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
  // 找出所有 qualificationId = 此資格的配對
  const assignmentRows = await db.select({ id: caseAssignments.id }).from(caseAssignments).where(eq(caseAssignments.qualificationId, qualificationId));
  if (assignmentRows.length === 0) return 0;
  const assignmentIds = assignmentRows.map(a => a.id);
  let count = 0;
  for (const aid of assignmentIds) {
    const members = await db.select().from(caseAssignmentWorkers)
      .where(and(eq(caseAssignmentWorkers.assignmentId, aid), eq(caseAssignmentWorkers.stage, 'employed')));
    count += members.length;
  }
  return count;
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

export async function createAssignment(data: InsertCaseAssignment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(caseAssignments).values(data);
  return result;
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
