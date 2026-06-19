import { eq, and, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, managers, workers, customers, InsertManager, InsertWorker, InsertCustomer } from "../drizzle/schema";
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
  const result = await db.insert(managers).values(data);
  return result;
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

export async function getWorkerByIdNumber(idNumber: string, excludeId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const conditions = excludeId
    ? and(eq(workers.idNumber, idNumber), ne(workers.id, excludeId))
    : eq(workers.idNumber, idNumber);
  const result = await db.select().from(workers).where(conditions).limit(1);
  return result[0];
}

export async function createWorker(data: InsertWorker) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(workers).values(data);
  return result;
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
