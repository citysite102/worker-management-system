import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    // ── 角色與帳號型別（P0 多角色）──────────────────────────────────────────────
    // role：內部人員權限層級（staff 於 P0 新增，附加於末尾以利相容 migration）
    role: mysqlEnum("role", ["user", "admin", "staff"])
      .default("user")
      .notNull(),
    // accountType：公開平台的自助帳號型別；內部/owner 帳號為 null
    accountType: mysqlEnum("accountType", ["worker", "employer", "staff"]),
    // 帳號 ↔ 業務資料表連結（P1/P2 註冊時才寫入；此處不設 DB 外鍵，先鬆綁）
    workerId: int("workerId"),
    customerId: int("customerId"),
    // 聯絡與偏好（手機/WhatsApp OTP、介面語言）
    phone: varchar("phone", { length: 20 }),
    phoneVerified: int("phoneVerified").default(0).notNull(), // 0/1（沿用專案以 int 表布林的慣例）
    preferredLang: mysqlEnum("preferredLang", ["zh-TW", "vi", "id", "en"]),
    // Email/密碼登入用（scrypt 雜湊；社群/OAuth 帳號為 null）。見 server/_core/auth。
    passwordHash: varchar("passwordHash", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  t => ({
    accountTypeIdx: index("users_accountType_idx").on(t.accountType),
    workerIdIdx: index("users_workerId_idx").on(t.workerId),
    customerIdIdx: index("users_customerId_idx").on(t.customerId),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Audit Logs（操作稽核，公開平台必備）────────────────────────────────────
export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId"), // 執行者（系統事件可為 null）
    action: varchar("action", { length: 80 }).notNull(), // 如 "auth.login"、"user.role_change"
    entityType: varchar("entityType", { length: 50 }), // 受影響實體型別
    entityId: int("entityId"), // 受影響實體 id
    meta: text("meta"), // 額外資訊（JSON 字串）
    ip: varchar("ip", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => ({
    actorIdx: index("audit_logs_actorUserId_idx").on(t.actorUserId),
    entityIdx: index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    createdIdx: index("audit_logs_createdAt_idx").on(t.createdAt),
  })
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── Managers（負責人）───────────────────────────────────────────────────────
export const managers = mysqlTable("managers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Manager = typeof managers.$inferSelect;
export type InsertManager = typeof managers.$inferInsert;

// ─── Workers（移工 / 外國人資料）─────────────────────────────────────────────
export const workers = mysqlTable(
  "workers",
  {
    id: int("id").autoincrement().primaryKey(),

    // ── 基本資料 ──────────────────────────────────────────────────────────────
    /** 系統流水編號（如 00026），自動由 id 補零產生，不存 DB，前端計算 */
    workerNo: varchar("workerNo", { length: 50 }), // 編號（手動輸入，自由文字）
    nameEn: varchar("nameEn", { length: 100 }), // 英文姓名
    nameCn: varchar("nameCn", { length: 50 }), // 中文姓名
    /** 相容舊欄位：若 nameCn 有值則優先顯示，否則 fallback 至 name */
    name: varchar("name", { length: 100 }).notNull(), // 顯示用姓名（必填，相容舊資料）
    birthDate: varchar("birthDate", { length: 10 }), // 出生日期 YYYY-MM-DD
    gender: mysqlEnum("gender", ["male", "female", "other"]), // 性別
    nationality: varchar("nationality", { length: 50 }), // 國籍（含國碼，如 "009 印尼"）
    birthPlace: varchar("birthPlace", { length: 100 }), // 出生地點（國籍）
    occupation: mysqlEnum("occupation", [
      // 職業
      "caregiver_family", // 家庭看護工
      "caregiver_hospital", // 機構看護工
      "manufacturing", // 製造業
      "construction", // 營造業
      "agriculture", // 農業
      "fishery", // 漁業
      "other", // 其他
    ]),

    // ── 狀態 ──────────────────────────────────────────────────────────────────
    lifecycleStatus: mysqlEnum("lifecycleStatus", [
      "employed", // 在職中
      "idle_in_tw", // 待業中（在台灣）
      "preparing_abroad", // 準備來台（在母國）
      "returned", // 已回國（結案，未來可聯繫）
      "absconded", // 逃跑（已結案）
    ]).notNull(),
    documentStatus: mysqlEnum("documentStatus", [
      "not_started", // 未啟動
      "pending_supplement", // 待補件
      "expiring_soon", // 即將到期
      "complete", // 完備
    ]).notNull(),
    managerId: int("managerId")
      .notNull()
      .references(() => managers.id),

    // ── 證件資料 ──────────────────────────────────────────────────────────────
    residentPermitNo: varchar("residentPermitNo", { length: 30 }), // 統一證碼（居留證號）
    residentPermitExpiry: varchar("residentPermitExpiry", { length: 10 }), // 居留證有效日期
    passportNo: varchar("passportNo", { length: 30 }), // 護照號碼
    passportExpiry: varchar("passportExpiry", { length: 10 }), // 護照有效日期
    entryDate: varchar("entryDate", { length: 10 }), // 入國日期

    // ── 聯絡資料 ──────────────────────────────────────────────────────────────
    phone: varchar("phone", { length: 20 }), // 在臺聯絡手機號碼
    email: varchar("email", { length: 200 }), // 電子信箱

    // ── 體檢資料 ──────────────────────────────────────────────────────────────
    // lastMedicalExamDate 仍有用：作為健檢合規引擎的 fallback（案件層未登錄時，
    // 若此日落在某里程碑窗口內即視為完成）。見 shared/healthCheck.ts。
    lastMedicalExamDate: varchar("lastMedicalExamDate", { length: 10 }), // 最近一次體檢日期
    /**
     * @deprecated 手動註記的「下次體檢類型」已被合規引擎取代——下一次應辦的
     * 定期健檢（6/18/30 個月）由 dashboard.compliance 依聘僱起始日自動推算。
     * 保留欄位以相容既有資料，不再作為提醒依據；請勿於新流程依賴此欄位。
     */
    nextMedicalExamType: mysqlEnum("nextMedicalExamType", [
      // 下次需要體檢類型（已停用，改由引擎推算）
      "6_month", // 6個月體檢
      "annual", // 年度體檢
      "pre_entry", // 入境前體檢
      "other", // 其他
    ]),

    // ── 附件（S3 key）────────────────────────────────────────────────────────
    photoKey: varchar("photoKey", { length: 300 }), // 大頭照
    ktpKey: varchar("ktpKey", { length: 300 }), // 母國身分證(KTP)
    residentPermitFrontKey: varchar("residentPermitFrontKey", { length: 300 }), // 居留證正面
    residentPermitBackKey: varchar("residentPermitBackKey", { length: 300 }), // 居留證被面
    passportKey: varchar("passportKey", { length: 300 }), // 護照
    passportEntryKey: varchar("passportEntryKey", { length: 300 }), // 護照入境頁
    medicalReportKey: varchar("medicalReportKey", { length: 300 }), // 體檢報告

    // ── 其他 ──────────────────────────────────────────────────────────────────
    externalLink: varchar("externalLink", { length: 500 }), // 外部連結（Google Drive 等）
    notes: text("notes"), // 備註

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    managerIdx: index("workers_managerId_idx").on(t.managerId),
    permitNoIdx: index("workers_residentPermitNo_idx").on(t.residentPermitNo),
    passportNoIdx: index("workers_passportNo_idx").on(t.passportNo),
  })
);

export type Worker = typeof workers.$inferSelect;
export type InsertWorker = typeof workers.$inferInsert;

// ─── Customers（雇主）────────────────────────────────────────────────────────
export const customers = mysqlTable(
  "customers",
  {
    id: int("id").autoincrement().primaryKey(),

    // ── 雇主類型 ──────────────────────────────────────────────────────────────
    /** individual = 個人雇主（家庭看護）, company = 公司行號 */
    employerType: mysqlEnum("employerType", ["individual", "company"])
      .notNull()
      .default("company"),

    // ── 雇主基本資料（兩種類型共用）────────────────────────────────────────────
    name: varchar("name", { length: 100 }).notNull(), // 雇主姓名 / 公司名稱
    employerNo: varchar("employerNo", { length: 20 }), // 雇主編號（如 00033）
    phone: varchar("phone", { length: 20 }), // 行動電話
    landline: varchar("landline", { length: 20 }), // 市內電話
    address: varchar("address", { length: 200 }), // 通訊地址
    registeredAddress: varchar("registeredAddress", { length: 200 }), // 戶籍地址（個人）/ 登記地址（公司）
    referrer: varchar("referrer", { length: 100 }), // 介紹人

    // ── 個人雇主專屬欄位 ──────────────────────────────────────────────────────
    idNo: varchar("idNo", { length: 12 }), // 雇主國民身分證字號
    preCourseNo: varchar("preCourseNo", { length: 50 }), // 聘前講習證明序號
    idFrontKey: varchar("idFrontKey", { length: 300 }), // 雇主身分證正面（S3）
    idBackKey: varchar("idBackKey", { length: 300 }), // 雇主身分證反面（S3）

    // ── 被照顧者資料（個人雇主 / 家庭看護專屬）──────────────────────────────────
    careReceiverNo: varchar("careReceiverNo", { length: 20 }), // 被看護者編號
    careReceiverName: varchar("careReceiverName", { length: 50 }), // 被照顧者姓名
    careReceiverBirthDate: varchar("careReceiverBirthDate", { length: 10 }), // 出生年月日 YYYY-MM-DD
    careReceiverIdNo: varchar("careReceiverIdNo", { length: 12 }), // 被照顧者國民身分證字號
    careReceiverAddress: varchar("careReceiverAddress", { length: 200 }), // 被照顧者戶籍地址
    careReceiverQualification: varchar("careReceiverQualification", {
      length: 100,
    }), // 被照顧者申請資格
    careReceiverRelation: varchar("careReceiverRelation", { length: 50 }), // 聘前講習上課者與被看護者關係
    careReceiverIdFrontKey: varchar("careReceiverIdFrontKey", { length: 300 }), // 被看護者身分證正面（S3）
    careReceiverIdBackKey: varchar("careReceiverIdBackKey", { length: 300 }), // 被看護者身分證反面（S3）

    // ── 公司行號專屬欄位 ──────────────────────────────────────────────────────
    taxId: varchar("taxId", { length: 8 }), // 統一編號
    industry: varchar("industry", { length: 50 }), // 產業
    contactName: varchar("contactName", { length: 50 }), // 聯絡窗口姓名
    contactPhone: varchar("contactPhone", { length: 20 }), // 聯絡窗口電話

    // ── 媒合案件 ──────────────────────────────────────────────────────────────
    caseNo: varchar("caseNo", { length: 20 }), // 媒合案件編號
    caseStatus: mysqlEnum("caseStatus", [
      "pending", // 待處理
      "processing", // 處理中
      "matched", // 已媒合
      "completed", // 已完成
      "cancelled", // 已取消
    ]),

    // ── 申請資格 ──────────────────────────────────────────────────────────────
    jobSeekerType: mysqlEnum("jobSeekerType", [
      // 求才類別
      "new_hire", // 新聘
      "renewal", // 續聘
      "transfer", // 轉換雇主
      "supplement", // 補件
    ]),
    jobSeekerDate: varchar("jobSeekerDate", { length: 10 }), // 求才日期 YYYY-MM-DD
    jobSeekerFileKey: varchar("jobSeekerFileKey", { length: 300 }), // 求才資格檔案（S3）
    recruitmentLetterType: mysqlEnum("recruitmentLetterType", [
      // 招募函類別
      "domestic", // 國內招募
      "overseas", // 國外招募
      "both", // 國內外
    ]),
    recruitmentLetterDate: varchar("recruitmentLetterDate", { length: 10 }), // 招募函申請日期
    recruitmentLetterFileKey: varchar("recruitmentLetterFileKey", {
      length: 300,
    }), // 招募函許可檔案（S3）
    recruitmentPermitNote: text("recruitmentPermitNote"), // 招募許可情況說明
    recruitmentPermitDays: int("recruitmentPermitDays"), // 許可天數
    previousWorkerDepartureDate: varchar("previousWorkerDepartureDate", {
      length: 10,
    }), // 舊工離境日期

    // ── 聘僱函 ────────────────────────────────────────────────────────────────
    employmentLetterType: mysqlEnum("employmentLetterType", [
      // 聘僱函類別
      "initial", // 初次聘僱
      "renewal", // 續聘
      "transfer", // 轉換
    ]),
    employmentLetterDate: varchar("employmentLetterDate", { length: 10 }), // 聘僱函申請日期
    employmentLetterFileKey: varchar("employmentLetterFileKey", {
      length: 300,
    }), // 聘僱函檔案（S3）
    approvedStartDate: varchar("approvedStartDate", { length: 10 }), // 核准聘僱起始日
    approvedPeriod: varchar("approvedPeriod", { length: 50 }), // 核准聘僱期限（如 3年）
    approvedEndDate: varchar("approvedEndDate", { length: 10 }), // 核准聘僱截止日

    // ── 系統管理欄位 ──────────────────────────────────────────────────────────
    contractStatus: mysqlEnum("contractStatus", [
      "negotiating", // 洽談中
      "signed", // 已簽約
      "in_service", // 服務中
      "pending_renewal", // 待續約
      "ended", // 已結束
    ]).notNull(),
    pricingTier: mysqlEnum("pricingTier", ["standard", "custom"]).notNull(),
    managerId: int("managerId")
      .notNull()
      .references(() => managers.id),
    notes: text("notes"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    managerIdx: index("customers_managerId_idx").on(t.managerId),
    taxIdIdx: index("customers_taxId_idx").on(t.taxId),
  })
);

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ─── Cases（案件）────────────────────────────────────────────────────────────
export const cases = mysqlTable(
  "cases",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId")
      .notNull()
      .references(() => customers.id), // → customers.id
    name: varchar("name", { length: 100 }).notNull(), // 案件名稱
    caseNo: varchar("caseNo", { length: 30 }), // 案件編號（GVC25-YYYYMMDD-NNN）
    managerId: int("managerId")
      .notNull()
      .references(() => managers.id), // → managers.id
    status: mysqlEnum("status", [
      "in_progress", // 進行中
      "completed", // 已完成
      "paused", // 暫停
      "cancelled", // 取消
    ])
      .notNull()
      .default("in_progress"),
    caseCondition: varchar("caseCondition", { length: 100 }), // 案件情況（自由文字）
    // ── 公開媒合平台（P1）──────────────────────────────────────────────────────
    // 既有需求單在公開「找工作」頁曝光時使用的縣市（去識別，staff 於後台補齊）。
    // 精確地址（含 PII）永不對公開層開放，只露此縣市層級。
    publicCity: varchar("publicCity", { length: 20 }), // 公開顯示縣市
    // ── 主要移工 ──────────────────────────────────────────────────────────────
    primaryWorkerId: int("primaryWorkerId"), // → workers.id（主要外國人）
    careReceiverId: int("careReceiverId"), // → customer_care_receivers.id（個人雇主時關聯被照顧者）
    customerQualificationId: int("customerQualificationId"), // 可選 → customer_qualifications.id（關聯客戶資格）
    // ── 標記 ──────────────────────────────────────────────────────────────────
    needsReview: int("needsReview").default(0).notNull(), // 需檢查標記（0/1）
    // ── 附件 ──────────────────────────────────────────────────────────────────
    recruitmentPermitFileKey: varchar("recruitmentPermitFileKey", {
      length: 300,
    }), // 招募許可函（S3）

    // ── 聘僱時間 ─────────────────────────────────────────────────────────────────────────────
    continuousEmploymentDate: varchar("continuousEmploymentDate", {
      length: 10,
    }), // 本案接續聘僱日期 YYYY-MM-DD
    employmentPeriodMonths: int("employmentPeriodMonths"), // 期間長度（月）
    terminationDate: varchar("terminationDate", { length: 10 }), // 終止聘僱日期 YYYY-MM-DD

    // ── 代辦事項 ─────────────────────────────────────────────────────────────────────────────
    recruitmentAgencyItems: mysqlEnum("recruitmentAgencyItems", [
      // 招募函代辦事項
      "none", // 無
      "self", // 自辦
      "agency", // 仓介代辦
    ]),
    employmentAgencyItems: mysqlEnum("employmentAgencyItems", [
      // 聘僱函代辦事項
      "none", // 無
      "self", // 自辦
      "agency", // 仓介代辦
    ]),
    postEmploymentInsurance: mysqlEnum("postEmploymentInsurance", [
      // 聘僱後尚未完成保险
      "none", // 無
      "health", // 健保待辦
      "accident", // 意外险待辦
      "both", // 健保+意外险待辦
    ]),

    // ── 聘僱許可函與情況 ───────────────────────────────────────────────────────────────
    employmentPermitFileKey: varchar("employmentPermitFileKey", {
      length: 300,
    }), // 聘僱許可函（S3）
    employmentStatus: mysqlEnum("employmentStatus", [
      // 聘僱情況
      "normal", // 正常
      "suspended", // 暫停
      "terminated", // 終止
      "transferred", // 轉就
    ]),
    terminationLetterFileKey: varchar("terminationLetterFileKey", {
      length: 300,
    }), // 終止函（S3）

    // Phase 3: 承接通報/入國通報（3日內）
    notificationNo: varchar("notificationNo", { length: 50 }), // 通報書序號
    entryNotificationDate: varchar("entryNotificationDate", { length: 10 }), // 入國通報申請日
    certificateNo: varchar("certificateNo", { length: 50 }), // 證明書序號

    // Phase 3: 內政部移民署
    niaCategory: varchar("niaCategory", { length: 50 }), // 一站式類別
    niaNo: varchar("niaNo", { length: 50 }), // 一站式序號
    residencePermitSubmitDate: varchar("residencePermitSubmitDate", {
      length: 10,
    }), // 居留證申請送審日

    // Phase 3: 勞動部聘僱許可函
    molReceiptNo: varchar("molReceiptNo", { length: 50 }), // 收文號
    employmentLetterCategory: varchar("employmentLetterCategory", {
      length: 50,
    }), // 聘僱函類別
    applicationSubmitDate: varchar("applicationSubmitDate", { length: 10 }), // 申請書送件日
    issuanceDate: varchar("issuanceDate", { length: 10 }), // 發文日期
    approvalReceiptDate: varchar("approvalReceiptDate", { length: 10 }), // 核准收件日

    // Phase 4: 保險管理
    healthInsurance: varchar("healthInsurance", { length: 200 }), // 健保投保（投保單位/編號）
    healthInsurancePolicyKey: varchar("healthInsurancePolicyKey", {
      length: 300,
    }), // 健保保單（S3）
    accidentInsurance: varchar("accidentInsurance", { length: 200 }), // 意外險（投保單位/編號）
    accidentInsurancePolicyKey: varchar("accidentInsurancePolicyKey", {
      length: 300,
    }), // 意外險保單（S3）

    // Phase 4: 體檢管理
    prevMedicalExamDate: varchar("prevMedicalExamDate", { length: 10 }), // 前次體檢日期
    prevMedicalReportKey: varchar("prevMedicalReportKey", { length: 300 }), // 前次體檢報告（S3）
    entryMedicalExamDate: varchar("entryMedicalExamDate", { length: 10 }), // 入境3天體檢日期
    entryMedicalReportKey: varchar("entryMedicalReportKey", { length: 300 }), // 入境3天體檢報告（S3）
    exam6mDate: varchar("exam6mDate", { length: 10 }), // 6個月體檢日期
    exam6mReportKey: varchar("exam6mReportKey", { length: 300 }), // 6個月體檢報告（S3）
    exam18mDate: varchar("exam18mDate", { length: 10 }), // 18個月體檢日期
    exam18mReportKey: varchar("exam18mReportKey", { length: 300 }), // 18個月體檢報告（S3）
    exam30mDate: varchar("exam30mDate", { length: 10 }), // 30個月體檢日期
    exam30mReportKey: varchar("exam30mReportKey", { length: 300 }), // 30個月體檢報告（S3）

    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    customerIdx: index("cases_customerId_idx").on(t.customerId),
    managerIdx: index("cases_managerId_idx").on(t.managerId),
  })
);
export type Case = typeof cases.$inferSelect;
export type InsertCase = typeof cases.$inferInsert;

// ─── Case Qualifications（案件資格）─────────────────────────────────────────
export const caseQualifications = mysqlTable(
  "case_qualifications",
  {
    id: int("id").autoincrement().primaryKey(),
    caseId: int("caseId")
      .notNull()
      .references(() => cases.id), // → cases.id
    label: varchar("label", { length: 100 }).notNull(), // 例：案件資格一(幫傭)
    category: mysqlEnum("category", [
      "labor_in", // 勞基法內
      "labor_out", // 勞基法外
      "professional", // 專業/評點（白領、僑外生等）
    ]).notNull(),
    qualType: mysqlEnum("qualType", [
      "caregiver", // 看護
      "domestic_helper", // 幫傭
      "manufacturing", // 製造業
      "agriculture", // 農業
      "construction", // 營造業
      "white_collar", // 白領
      "intermediate", // 中階技術人力
      "overseas_student", // 評點制僑外生
    ]).notNull(),
    // 法定雇主資料
    employerName: varchar("employerName", { length: 100 }),
    employerTaxId: varchar("employerTaxId", { length: 8 }),
    employerNote: text("employerNote"),
    // 進度狀態：申請進度
    applicationStatus: mysqlEnum("applicationStatus", [
      "preparing", // 準備中
      "submitted", // 已送件
      "reviewing", // 審核中
      "approved", // 已核准
      "supplement", // 補件中
      "rejected", // 已退件
    ])
      .notNull()
      .default("preparing"),
    expectedApprovalDate: varchar("expectedApprovalDate", { length: 10 }),
    // 進度狀態：聘僱人數
    quotaTotal: int("quotaTotal").notNull().default(0),
    // 進度狀態：文件有效日期
    docValidUntil: varchar("docValidUntil", { length: 10 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    caseIdx: index("case_qualifications_caseId_idx").on(t.caseId),
  })
);
export type CaseQualification = typeof caseQualifications.$inferSelect;
export type InsertCaseQualification = typeof caseQualifications.$inferInsert;

// ─── Case Demands（媒合需求）────────────────────────────────────────────────
export const caseDemands = mysqlTable(
  "case_demands",
  {
    id: int("id").autoincrement().primaryKey(),
    caseId: int("caseId")
      .notNull()
      .references(() => cases.id), // → cases.id
    label: varchar("label", { length: 100 }).notNull(),
    qualificationId: int("qualificationId"), // 可選 → case_qualifications.id
    qualType: mysqlEnum("qualType", [
      "caregiver",
      "domestic_helper",
      "manufacturing",
      "agriculture",
      "construction",
      "white_collar",
      "intermediate",
      "overseas_student",
    ]).notNull(),
    neededCount: int("neededCount").notNull().default(1),
    status: mysqlEnum("status", [
      "open", // 開放中
      "filling", // 媒合中
      "fulfilled", // 已媒合滿
      "closed", // 已關閉
    ])
      .notNull()
      .default("open"),
    // 公開媒合平台（P1）：既有需求單預設在公開「找工作」頁曝光（open/filling），
    // staff 可逐筆隱藏（1＝不公開）。已媒合滿/關閉本就不曝光。
    publicHidden: int("publicHidden").notNull().default(0), // 0/1
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    caseIdx: index("case_demands_caseId_idx").on(t.caseId),
    qualificationIdx: index("case_demands_qualificationId_idx").on(
      t.qualificationId
    ),
  })
);
export type CaseDemand = typeof caseDemands.$inferSelect;
export type InsertCaseDemand = typeof caseDemands.$inferInsert;

// ─── Case Assignments（配對／批次）──────────────────────────────────────────
export const caseAssignments = mysqlTable(
  "case_assignments",
  {
    id: int("id").autoincrement().primaryKey(),
    caseId: int("caseId")
      .notNull()
      .references(() => cases.id), // → cases.id
    label: varchar("label", { length: 100 }),
    demandId: int("demandId"), // 可選 → case_demands.id
    qualificationId: int("qualificationId"), // 可選 → case_qualifications.id
    batchNote: text("batchNote"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    caseIdx: index("case_assignments_caseId_idx").on(t.caseId),
    demandIdx: index("case_assignments_demandId_idx").on(t.demandId),
    qualificationIdx: index("case_assignments_qualificationId_idx").on(
      t.qualificationId
    ),
  })
);
export type CaseAssignment = typeof caseAssignments.$inferSelect;
export type InsertCaseAssignment = typeof caseAssignments.$inferInsert;

// ─── Case Assignment Workers（配對成員）─────────────────────────────────────
export const caseAssignmentWorkers = mysqlTable(
  "case_assignment_workers",
  {
    id: int("id").autoincrement().primaryKey(),
    assignmentId: int("assignmentId")
      .notNull()
      .references(() => caseAssignments.id), // → case_assignments.id
    caseId: int("caseId")
      .notNull()
      .references(() => cases.id), // 冗餘 → cases.id（便於唯一性檢查）
    workerId: int("workerId")
      .notNull()
      .references(() => workers.id), // → workers.id
    stage: mysqlEnum("stage", [
      "candidate", // 人選評估
      "confirmed", // 已確認
      "upcoming", // 即將聘僱
      "employed", // 聘僱中
      "departed", // 已離職
      "rejected", // 婉拒/未錄取
    ])
      .notNull()
      .default("candidate"),
    matchNote: text("matchNote"),
    // 聘僱階段欄位
    expectedDocDate: varchar("expectedDocDate", { length: 10 }),
    expectedEntryDate: varchar("expectedEntryDate", { length: 10 }),
    departureNote: text("departureNote"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    assignmentIdx: index("caw_assignmentId_idx").on(t.assignmentId),
    caseIdx: index("caw_caseId_idx").on(t.caseId),
    workerIdx: index("caw_workerId_idx").on(t.workerId),
  })
);
export type CaseAssignmentWorker = typeof caseAssignmentWorkers.$inferSelect;
export type InsertCaseAssignmentWorker =
  typeof caseAssignmentWorkers.$inferInsert;

// ─── Case Employments（正式聘僱合約）────────────────────────────────────────
export const caseEmployments = mysqlTable(
  "case_employments",
  {
    id: int("id").autoincrement().primaryKey(),
    caseId: int("caseId")
      .notNull()
      .references(() => cases.id), // → cases.id
    workerId: int("workerId")
      .notNull()
      .references(() => workers.id), // → workers.id
    qualificationId: int("qualificationId"), // 可選 → case_qualifications.id
    position: varchar("position", { length: 100 }),
    contractStart: varchar("contractStart", { length: 10 }),
    contractEnd: varchar("contractEnd", { length: 10 }),
    status: mysqlEnum("status", [
      "pending", // 待確認
      "active", // 在職
      "terminated", // 已終止
      "expired", // 合約到期
    ])
      .notNull()
      .default("pending"),
    terminationReason: text("terminationReason"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    caseIdx: index("case_employments_caseId_idx").on(t.caseId),
    workerIdx: index("case_employments_workerId_idx").on(t.workerId),
  })
);
export type CaseEmployment = typeof caseEmployments.$inferSelect;
export type InsertCaseEmployment = typeof caseEmployments.$inferInsert;

// ─── Customer Care Receivers（被照顧者，個人雇主用）─────────────────────────
export const customerCareReceivers = mysqlTable(
  "customer_care_receivers",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId")
      .notNull()
      .references(() => customers.id), // → customers.id
    careReceiverNo: varchar("careReceiverNo", { length: 20 }), // 被看護者編號
    careReceiverName: varchar("careReceiverName", { length: 50 }), // 被照顧者姓名
    careReceiverBirthDate: varchar("careReceiverBirthDate", { length: 10 }), // 出生年月日 YYYY-MM-DD
    careReceiverIdNo: varchar("careReceiverIdNo", { length: 12 }), // 被照顧者國民身分證字號
    careReceiverAddress: varchar("careReceiverAddress", { length: 200 }), // 被照顧者戶籍地址
    careReceiverQualification: varchar("careReceiverQualification", {
      length: 100,
    }), // 被照顧者申請資格
    careReceiverRelation: varchar("careReceiverRelation", { length: 50 }), // 聘前講習上課者與被看護者關係
    careReceiverIdFrontKey: varchar("careReceiverIdFrontKey", { length: 300 }), // 被看護者身分證正面（S3）
    careReceiverIdBackKey: varchar("careReceiverIdBackKey", { length: 300 }), // 被看護者身分證反面（S3）
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    customerIdx: index("customer_care_receivers_customerId_idx").on(
      t.customerId
    ),
  })
);
export type CustomerCareReceiver = typeof customerCareReceivers.$inferSelect;
export type InsertCustomerCareReceiver =
  typeof customerCareReceivers.$inferInsert;

// ─── Customer Qualifications（申請資格，個人雇主 + 公司行號共用）────────────
export const customerQualifications = mysqlTable(
  "customer_qualifications",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId")
      .notNull()
      .references(() => customers.id), // → customers.id
    /** 資格類別：family=家庭類雇主, business=事業類雇主（可擴充） */
    qualifierCategory: mysqlEnum("qualifierCategory", ["family", "business"])
      .notNull()
      .default("family"),
    careReceiverId: int("careReceiverId"), // 可選 → customer_care_receivers.id（家庭類用）
    caseId: int("caseId"), // 可選 → cases.id（關聯案件，1:1）
    label: varchar("label", { length: 100 }), // 顯示用標籤（如「王小明看護申請」）
    // ── 媒合案件 ──────────────────────────────────────────────────────────────
    caseNo: varchar("caseNo", { length: 20 }), // 媒合案件編號（文字，可與 cases.caseNo 對應）
    caseStatus: mysqlEnum("caseStatus", [
      "pending", // 待處理
      "processing", // 處理中
      "matched", // 已媒合
      "completed", // 已完成
      "cancelled", // 已取消
    ]),
    managerId: int("managerId"), // 管理負責人 → managers.id
    // ── 申請資格 ──────────────────────────────────────────────────────────────
    jobSeekerType: mysqlEnum("jobSeekerType", [
      "new_hire", // 新聘
      "renewal", // 續聘
      "transfer", // 轉換雇主
      "supplement", // 補件
    ]),
    jobSeekerDate: varchar("jobSeekerDate", { length: 10 }),
    jobSeekerFileKey: varchar("jobSeekerFileKey", { length: 300 }),
    recruitmentLetterType: mysqlEnum("recruitmentLetterType", [
      "domestic", // 國內招募
      "overseas", // 國外招募
      "both", // 國內外
    ]),
    recruitmentLetterDate: varchar("recruitmentLetterDate", { length: 10 }),
    recruitmentLetterFileKey: varchar("recruitmentLetterFileKey", {
      length: 300,
    }),
    recruitmentPermitNote: text("recruitmentPermitNote"),
    recruitmentPermitDays: int("recruitmentPermitDays"),
    previousWorkerDepartureDate: varchar("previousWorkerDepartureDate", {
      length: 10,
    }),
    // ── 聘僱函 ────────────────────────────────────────────────────────────────
    employmentLetterType: mysqlEnum("employmentLetterType", [
      "initial", // 初次聘僱
      "renewal", // 續聘
      "transfer", // 轉換
    ]),
    employmentLetterDate: varchar("employmentLetterDate", { length: 10 }),
    employmentLetterFileKey: varchar("employmentLetterFileKey", {
      length: 300,
    }),
    approvedStartDate: varchar("approvedStartDate", { length: 10 }),
    approvedPeriod: varchar("approvedPeriod", { length: 50 }),
    approvedEndDate: varchar("approvedEndDate", { length: 10 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    customerIdx: index("customer_qualifications_customerId_idx").on(
      t.customerId
    ),
    careReceiverIdx: index("customer_qualifications_careReceiverId_idx").on(
      t.careReceiverId
    ),
    caseIdx: index("customer_qualifications_caseId_idx").on(t.caseId),
  })
);
export type CustomerQualification = typeof customerQualifications.$inferSelect;
export type InsertCustomerQualification =
  typeof customerQualifications.$inferInsert;

// ─── KPI Snapshot（儀表板每日快照，用於趨勢比較）──────────────────────────────
// 每日一筆（snapshotDate 為主鍵，格式 YYYY-MM-DD，採台北時區）。
// 儀表板載入時 upsert 當日快照，並與前一筆快照比較以計算 ▲/▼ 變化量。
export const kpiSnapshots = mysqlTable("kpi_snapshots", {
  snapshotDate: varchar("snapshotDate", { length: 10 }).primaryKey(), // YYYY-MM-DD
  workers: int("workers").notNull().default(0), // 移工總數
  customers: int("customers").notNull().default(0), // 雇主總數
  cases: int("cases").notNull().default(0), // 案件總數
  employed: int("employed").notNull().default(0), // 在職移工
  expiringSoon: int("expiringSoon").notNull().default(0), // 即將到期（人數）
  expired: int("expired").notNull().default(0), // 已過期（人數）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type KpiSnapshot = typeof kpiSnapshots.$inferSelect;
export type InsertKpiSnapshot = typeof kpiSnapshots.$inferInsert;

// ─── Job Postings（公開需求單，P1）────────────────────────────────────────────
// 雇主自公開站張貼的工作需求：draft → pending_review → approved（自動轉 case）
// / rejected；上架後 paused/filled/closed。審核通過即建立對應 case + 資格 + 需求，
// 延續現有 案件→資格→媒合→僱傭 流程（規格 §7.3、§10）。
export const jobPostings = mysqlTable(
  "job_postings",
  {
    id: int("id").autoincrement().primaryKey(),
    // 張貼者（自助雇主帳號）→ users.id；勾稽到既有名冊時填 customerId → customers.id
    employerUserId: int("employerUserId").notNull(),
    customerId: int("customerId"),
    // 職類（沿用內部 qualType enum；公開站收攏為 看護/房務/其他 三桶）
    jobType: mysqlEnum("jobType", [
      "caregiver",
      "domestic_helper",
      "manufacturing",
      "agriculture",
      "construction",
      "white_collar",
      "intermediate",
      "overseas_student",
    ]).notNull(),
    // 地點（縣市必填、區選填）
    city: varchar("city", { length: 20 }).notNull(),
    district: varchar("district", { length: 30 }),
    headcount: int("headcount").notNull().default(1), // 需求人數
    employmentType: mysqlEnum("employmentType", [
      "live_in", // 住家（同住）
      "live_out", // 不住家
      "institution", // 機構
      "other", // 其他
    ])
      .notNull()
      .default("live_in"),
    requirements: text("requirements"), // 條件（語言/經驗等，受法遵限制）
    publicDescription: text("publicDescription"), // 公開說明
    // 薪資以區間顯示（選填）
    salaryMin: int("salaryMin"),
    salaryMax: int("salaryMax"),
    expectedStartDate: varchar("expectedStartDate", { length: 10 }), // 期望上工日 YYYY-MM-DD
    // 狀態機（規格 §10）
    status: mysqlEnum("status", [
      "draft", // 草稿
      "pending_review", // 審核中
      "approved", // 已通過（上架）
      "rejected", // 已退件
      "paused", // 暫停
      "filled", // 已滿
      "closed", // 已關閉
    ])
      .notNull()
      .default("pending_review"),
    rejectReason: varchar("rejectReason", { length: 300 }), // 退件理由（結構化代碼 + 補正說明）
    caseId: int("caseId"), // 審核通過後建立的內部案件 → cases.id
    publishedAt: timestamp("publishedAt"), // 上架時間
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    employerIdx: index("job_postings_employerUserId_idx").on(t.employerUserId),
    statusIdx: index("job_postings_status_idx").on(t.status),
    caseIdx: index("job_postings_caseId_idx").on(t.caseId),
  })
);
export type JobPosting = typeof jobPostings.$inferSelect;
export type InsertJobPosting = typeof jobPostings.$inferInsert;

// ─── Moderation Events（審核稽核軌跡，P1）─────────────────────────────────────
// 需求單（未來含履歷/自填經歷）每次狀態轉移的審核紀錄（規格 §9.2、§10）。
export const moderationEvents = mysqlTable(
  "moderation_events",
  {
    id: int("id").autoincrement().primaryKey(),
    entityType: varchar("entityType", { length: 50 }).notNull(), // 如 "job_posting"
    entityId: int("entityId").notNull(),
    action: mysqlEnum("action", [
      "submit", // 送審
      "approve", // 通過
      "reject", // 退件
    ]).notNull(),
    reason: text("reason"), // 退件理由 / 備註
    staffId: int("staffId"), // 審核者 → users.id（系統事件可為 null）
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => ({
    entityIdx: index("moderation_events_entity_idx").on(
      t.entityType,
      t.entityId
    ),
  })
);
export type ModerationEvent = typeof moderationEvents.$inferSelect;
export type InsertModerationEvent = typeof moderationEvents.$inferInsert;

// ─── Match Requests（媒合意向 / 仲介居中，P3）──────────────────────────────────
// 任一方對職缺/移工表達「我有興趣」即建立一筆；雙方看不到彼此私密聯絡資訊，
// 一律由 staff 居中處理、必要時線下揭露（規格 §7.5、§10）。
export const matchRequests = mysqlTable(
  "match_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    // 發起者（登入使用者）→ users.id；型別依 accountType 帶入
    initiatorUserId: int("initiatorUserId").notNull(),
    initiatorType: mysqlEnum("initiatorType", ["worker", "employer", "other"])
      .notNull()
      .default("other"),
    // 標的：公開需求單 / 既有內部需求 / 移工（找移工 P2 用）
    targetType: mysqlEnum("targetType", [
      "job_posting",
      "case_demand",
      "worker",
    ]).notNull(),
    targetId: int("targetId").notNull(),
    status: mysqlEnum("status", [
      "new", // 新進
      "staff_handling", // 客服處理中
      "introduced", // 已引介
      "matched", // 成交
      "closed", // 關閉（不成/取消）
    ])
      .notNull()
      .default("new"),
    assignedStaffId: int("assignedStaffId"), // 承辦客服 → users.id
    note: text("note"), // 發起者留言（選填）
    staffNote: text("staffNote"), // 客服內部備註
    closeReason: varchar("closeReason", { length: 200 }), // 關閉原因（選填）
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  t => ({
    initiatorIdx: index("match_requests_initiator_idx").on(t.initiatorUserId),
    targetIdx: index("match_requests_target_idx").on(t.targetType, t.targetId),
    statusIdx: index("match_requests_status_idx").on(t.status),
  })
);
export type MatchRequest = typeof matchRequests.$inferSelect;
export type InsertMatchRequest = typeof matchRequests.$inferInsert;
