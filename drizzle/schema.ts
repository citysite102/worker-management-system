import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Managers（負責人）───────────────────────────────────────────────────────
export const managers = mysqlTable("managers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Manager = typeof managers.$inferSelect;
export type InsertManager = typeof managers.$inferInsert;

// ─── Workers（移工）──────────────────────────────────────────────────────────
export const workers = mysqlTable("workers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  nationality: varchar("nationality", { length: 50 }),
  idType: mysqlEnum("idType", ["resident_permit", "passport"]).notNull(),
  idNumber: varchar("idNumber", { length: 30 }).notNull().unique(),
  lifecycleStatus: mysqlEnum("lifecycleStatus", [
    "recruiting",
    "document_processing",
    "employed",
    "pending_renewal",
    "departed",
  ]).notNull(),
  documentStatus: mysqlEnum("documentStatus", [
    "not_started",
    "pending_supplement",
    "expiring_soon",
    "complete",
  ]).notNull(),
  managerId: int("managerId").notNull(),
  phone: varchar("phone", { length: 20 }),
  entryDate: varchar("entryDate", { length: 10 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Worker = typeof workers.$inferSelect;
export type InsertWorker = typeof workers.$inferInsert;

// ─── Customers（客戶）────────────────────────────────────────────────────────
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  taxId: varchar("taxId", { length: 8 }),
  industry: varchar("industry", { length: 50 }),
  contractStatus: mysqlEnum("contractStatus", [
    "negotiating",
    "signed",
    "in_service",
    "pending_renewal",
    "ended",
  ]).notNull(),
  pricingTier: mysqlEnum("pricingTier", ["standard", "custom"]).notNull(),
  managerId: int("managerId").notNull(),
  contactName: varchar("contactName", { length: 50 }),
  contactPhone: varchar("contactPhone", { length: 20 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;
