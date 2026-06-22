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

// ─── Workers（移工 / 外國人資料）─────────────────────────────────────────────
export const workers = mysqlTable("workers", {
  id: int("id").autoincrement().primaryKey(),

  // ── 基本資料 ──────────────────────────────────────────────────────────────
  /** 系統流水編號（如 00026），自動由 id 補零產生，不存 DB，前端計算 */
  nameEn: varchar("nameEn", { length: 100 }),           // 英文姓名
  nameCn: varchar("nameCn", { length: 50 }),             // 中文姓名
  /** 相容舊欄位：若 nameCn 有值則優先顯示，否則 fallback 至 name */
  name: varchar("name", { length: 100 }).notNull(),      // 顯示用姓名（必填，相容舊資料）
  birthDate: varchar("birthDate", { length: 10 }),       // 出生日期 YYYY-MM-DD
  gender: mysqlEnum("gender", ["male", "female", "other"]), // 性別
  nationality: varchar("nationality", { length: 50 }),   // 國籍（含國碼，如 "009 印尼"）
  birthPlace: varchar("birthPlace", { length: 100 }),    // 出生地點（國籍）
  occupation: mysqlEnum("occupation", [                  // 職業
    "caregiver_family",    // 家庭看護工
    "caregiver_hospital",  // 機構看護工
    "manufacturing",       // 製造業
    "construction",        // 營造業
    "agriculture",         // 農業
    "fishery",             // 漁業
    "other",               // 其他
  ]),

  // ── 狀態 ──────────────────────────────────────────────────────────────────
  lifecycleStatus: mysqlEnum("lifecycleStatus", [
    "recruiting",           // 招募中
    "document_processing",  // 文件辦理
    "employed",             // 在職中
    "pending_renewal",      // 待續聘
    "departed",             // 已離境
  ]).notNull(),
  documentStatus: mysqlEnum("documentStatus", [
    "not_started",          // 未啟動
    "pending_supplement",   // 待補件
    "expiring_soon",        // 即將到期
    "complete",             // 完備
  ]).notNull(),
  managerId: int("managerId").notNull(),

  // ── 證件資料 ──────────────────────────────────────────────────────────────
  residentPermitNo: varchar("residentPermitNo", { length: 30 }), // 統一證碼（居留證號）
  residentPermitExpiry: varchar("residentPermitExpiry", { length: 10 }), // 居留證有效日期
  passportNo: varchar("passportNo", { length: 30 }),             // 護照號碼
  passportExpiry: varchar("passportExpiry", { length: 10 }),     // 護照有效日期
  entryDate: varchar("entryDate", { length: 10 }),               // 入國日期

  // ── 聯絡資料 ──────────────────────────────────────────────────────────────
  phone: varchar("phone", { length: 20 }),       // 在臺聯絡手機號碼
  email: varchar("email", { length: 200 }),      // 電子信箱

  // ── 體檢資料 ──────────────────────────────────────────────────────────────
  lastMedicalExamDate: varchar("lastMedicalExamDate", { length: 10 }), // 最近一次體檢日期
  nextMedicalExamType: mysqlEnum("nextMedicalExamType", [              // 下次需要體檢類型
    "6_month",    // 6個月體檢
    "annual",     // 年度體檢
    "pre_entry",  // 入境前體檢
    "other",      // 其他
  ]),

  // ── 附件（S3 key）────────────────────────────────────────────────────────
  photoKey: varchar("photoKey", { length: 300 }),             // 大頭照
  ktpKey: varchar("ktpKey", { length: 300 }),                 // 母國身分證(KTP)
  residentPermitFrontKey: varchar("residentPermitFrontKey", { length: 300 }), // 居留證正面
  residentPermitBackKey: varchar("residentPermitBackKey", { length: 300 }),   // 居留證被面
  passportKey: varchar("passportKey", { length: 300 }),       // 護照
  passportEntryKey: varchar("passportEntryKey", { length: 300 }), // 護照入境頁
  medicalReportKey: varchar("medicalReportKey", { length: 300 }), // 體檢報告

  // ── 其他 ──────────────────────────────────────────────────────────────────
  externalLink: varchar("externalLink", { length: 500 }),  // 外部連結（Google Drive 等）
  notes: text("notes"),                                    // 備註

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
