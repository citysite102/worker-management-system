import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getAllManagers, createManager, deleteManager,
  getAllWorkers, getWorkerById, getWorkerByPermitNo, getWorkerByPassportNo, createWorker, updateWorker, deleteWorker,
  getAllCustomers, getCustomerById, getCustomerByTaxId, getCustomerByName, createCustomer, updateCustomer, deleteCustomer,
  getAllCases, getCaseById, createCase, updateCase, deleteCase, getCaseChildCounts,
  getQualificationsByCaseId, getQualificationById, createQualification, updateQualification, deleteQualification, getQuotaUsed,
  getDemandsByCaseId, getDemandById, createDemand, updateDemand, deleteDemand, getDemandProgressBatch,
  getAssignmentsByCaseId, getAssignmentById, createAssignment, updateAssignment, deleteAssignment,
  getMembersByCaseId, getMemberById, createMember, updateMember, deleteMember,
  getWorkerInvolvements, getCaseDimensions, getCaseDimensionsBatch, getQuotaUsedBatch,
  getEmploymentsByCase, createEmployment, updateEmployment, deleteEmployment,
  getCareReceiversByCustomerId, createCareReceiver, updateCareReceiver, deleteCareReceiver,
  getQualificationsByCustomerId, createCustomerQualification, updateCustomerQualification, deleteCustomerQualification,
} from "./db";
import { storagePut } from "./storage";
import {
  validateTwPhone, normalizePhone, validateResidentPermit, validatePassport, validateTaxId, validateNotFutureDate,
} from "../shared/validation";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const workerInput = z.object({
  // 基本資料
  name: z.string().min(1, "姓名為必填").max(100).transform(s => s.trim()),
  workerNo: z.string().max(50).optional().transform(s => s?.trim() || undefined),
  nameEn: z.string().max(100).optional().transform(s => s?.trim() || undefined),
  nameCn: z.string().max(50).optional().transform(s => s?.trim() || undefined),
  birthDate: z.string().optional().transform(s => s?.trim() || undefined),
  gender: z.enum(["male", "female", "other"]).optional(),
  nationality: z.string().max(50).optional().transform(s => s?.trim() || undefined),
  birthPlace: z.string().max(100).optional().transform(s => s?.trim() || undefined),
  occupation: z.enum(["caregiver_family", "caregiver_hospital", "manufacturing", "construction", "agriculture", "fishery", "other"]).optional(),
  // 狀態
  lifecycleStatus: z.enum(["employed", "idle_in_tw", "preparing_abroad", "returned", "absconded"]),
  documentStatus: z.enum(["not_started", "pending_supplement", "expiring_soon", "complete"]),
  managerId: z.number().int().positive("負責人為必填"),
  // 證件
  residentPermitNo: z.string().max(30).optional().transform(s => s?.trim() || undefined),
  residentPermitExpiry: z.string().optional().transform(s => s?.trim() || undefined),
  passportNo: z.string().max(30).optional().transform(s => s?.trim() || undefined),
  passportExpiry: z.string().optional().transform(s => s?.trim() || undefined),
  entryDate: z.string().optional().transform(s => s?.trim() || undefined),
  // 聯絡
  phone: z.string().optional().transform(s => s?.trim() || undefined),
  email: z.string().max(200).optional().transform(s => s?.trim() || undefined),
  // 體檢
  lastMedicalExamDate: z.string().optional().transform(s => s?.trim() || undefined),
  nextMedicalExamType: z.enum(["6_month", "annual", "pre_entry", "other"]).optional(),
  // 附件 S3 keys（由上傳 API 回傳後存入）
  photoKey: z.string().max(300).optional().transform(s => s?.trim() || undefined),
  ktpKey: z.string().max(300).optional().transform(s => s?.trim() || undefined),
  residentPermitFrontKey: z.string().max(300).optional().transform(s => s?.trim() || undefined),
  residentPermitBackKey: z.string().max(300).optional().transform(s => s?.trim() || undefined),
  passportKey: z.string().max(300).optional().transform(s => s?.trim() || undefined),
  passportEntryKey: z.string().max(300).optional().transform(s => s?.trim() || undefined),
  medicalReportKey: z.string().max(300).optional().transform(s => s?.trim() || undefined),
  // 其他
  externalLink: z.string().max(500).optional().transform(s => s?.trim() || undefined),
  notes: z.string().optional().transform(s => s?.trim() || undefined),
});

const customerInput = z.object({
  // 雇主類型
  employerType: z.enum(["individual", "company"]).default("company"),
  // 基本資料
  name: z.string().min(2, "名稱至少 2 字").max(100, "名稱最多 100 字").transform(s => s.trim()),
  employerNo: z.string().max(20).optional().transform(s => s?.trim() || undefined),
  phone: z.string().optional().transform(s => s?.trim() || undefined),
  landline: z.string().optional().transform(s => s?.trim() || undefined),
  address: z.string().max(200).optional().transform(s => s?.trim() || undefined),
  registeredAddress: z.string().max(200).optional().transform(s => s?.trim() || undefined),
  referrer: z.string().max(100).optional().transform(s => s?.trim() || undefined),
  // 個人雇主專屬
  idNo: z.string().max(12).optional().transform(s => s?.trim() || undefined),
  preCourseNo: z.string().max(50).optional().transform(s => s?.trim() || undefined),
  idFrontKey: z.string().max(300).optional().transform(s => s?.trim() || undefined),
  idBackKey: z.string().max(300).optional().transform(s => s?.trim() || undefined),
  // 被照顧者資料
  careReceiverNo: z.string().max(20).optional().transform(s => s?.trim() || undefined),
  careReceiverName: z.string().max(50).optional().transform(s => s?.trim() || undefined),
  careReceiverBirthDate: z.string().optional().transform(s => s?.trim() || undefined),
  careReceiverIdNo: z.string().max(12).optional().transform(s => s?.trim() || undefined),
  careReceiverAddress: z.string().max(200).optional().transform(s => s?.trim() || undefined),
  careReceiverQualification: z.string().max(100).optional().transform(s => s?.trim() || undefined),
  careReceiverRelation: z.string().max(50).optional().transform(s => s?.trim() || undefined),
  careReceiverIdFrontKey: z.string().max(300).optional().transform(s => s?.trim() || undefined),
  careReceiverIdBackKey: z.string().max(300).optional().transform(s => s?.trim() || undefined),
  // 公司行號專屬
  taxId: z.string().optional().transform(s => s?.trim() || undefined),
  industry: z.string().max(50).optional().transform(s => s?.trim() || undefined),
  contactName: z.string().max(50).optional().transform(s => s?.trim() || undefined),
  contactPhone: z.string().optional().transform(s => s?.trim() || undefined),
  // 媒合案件
  caseNo: z.string().max(20).optional().transform(s => s?.trim() || undefined),
  caseStatus: z.enum(["pending", "processing", "matched", "completed", "cancelled"]).optional(),
  // 申請資格
  jobSeekerType: z.enum(["new_hire", "renewal", "transfer", "supplement"]).optional(),
  jobSeekerDate: z.string().optional().transform(s => s?.trim() || undefined),
  jobSeekerFileKey: z.string().max(300).optional().transform(s => s?.trim() || undefined),
  recruitmentLetterType: z.enum(["domestic", "overseas", "both"]).optional(),
  recruitmentLetterDate: z.string().optional().transform(s => s?.trim() || undefined),
  recruitmentLetterFileKey: z.string().max(300).optional().transform(s => s?.trim() || undefined),
  recruitmentPermitNote: z.string().optional().transform(s => s?.trim() || undefined),
  recruitmentPermitDays: z.number().int().optional(),
  previousWorkerDepartureDate: z.string().optional().transform(s => s?.trim() || undefined),
  // 聘僱函
  employmentLetterType: z.enum(["initial", "renewal", "transfer"]).optional(),
  employmentLetterDate: z.string().optional().transform(s => s?.trim() || undefined),
  employmentLetterFileKey: z.string().max(300).optional().transform(s => s?.trim() || undefined),
  approvedStartDate: z.string().optional().transform(s => s?.trim() || undefined),
  approvedPeriod: z.string().max(50).optional().transform(s => s?.trim() || undefined),
  approvedEndDate: z.string().optional().transform(s => s?.trim() || undefined),
  // 系統欄位
  contractStatus: z.enum(["negotiating", "signed", "in_service", "pending_renewal", "ended"]),
  pricingTier: z.enum(["standard", "custom"]),
  managerId: z.number().int().positive("負責人為必填"),
  notes: z.string().optional().transform(s => s?.trim() || undefined),
  forceCreate: z.boolean().optional(),
});

// ─── Worker Validation Helper ─────────────────────────────────────────────────
function validateWorkerData(data: z.infer<typeof workerInput>, excludeId?: number) {
  return async () => {
    // 居留證格式
    if (data.residentPermitNo) {
      if (!validateResidentPermit(data.residentPermitNo)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "居留證統一證號格式不正確（格式：1字母+9碼數字，或2字母+8碼數字，共10碼）" });
      }
      // 唯一性
      const existing = await getWorkerByPermitNo(data.residentPermitNo, excludeId);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "此居留證號已存在，請確認是否重複建檔" });
    }
    // 護照格式
    if (data.passportNo) {
      if (!validatePassport(data.passportNo)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "護照號碼格式不正確（應為 6-9 碼英數字）" });
      }
      // 唯一性
      const existing = await getWorkerByPassportNo(data.passportNo, excludeId);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "此護照號碼已存在，請確認是否重複建檔" });
    }
    // 電話格式
    if (data.phone && !validateTwPhone(data.phone)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "電話格式不正確（手機 09 開頭 10 碼，或市話格式）" });
    }
    // Email 格式
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "電子信箱格式不正確" });
      }
    }
    // 入境日期不可晚於今天
    if (data.entryDate && !validateNotFutureDate(data.entryDate)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "入境日期不可晚於今天" });
    }
    // 外部連結 URL 格式
    if (data.externalLink) {
      try {
        const url = new URL(data.externalLink);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "連結格式不正確，請輸入完整 URL（例：https://drive.google.com/...）" });
        }
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "連結格式不正確，請輸入完整 URL（例：https://drive.google.com/...）" });
      }
    }
    // 跨欄位邏輯：在職時文件狀態不可為未啟動或待補件
    if (data.lifecycleStatus === "employed" && (data.documentStatus === "not_started" || data.documentStatus === "pending_supplement")) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "在職移工的文件狀態不應為未完成，請確認" });
    }
  };
}

// ─── Customer Validation Helper ───────────────────────────────────────────────
function validateCustomerData(data: z.infer<typeof customerInput>, excludeId?: number) {
  return async () => {
    if (data.taxId) {
      if (!validateTaxId(data.taxId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "統一編號格式不正確" });
      }
      const existingTaxId = await getCustomerByTaxId(data.taxId, excludeId);
      if (existingTaxId) throw new TRPCError({ code: "CONFLICT", message: "此統一編號已存在，請確認是否重複建檔" });
    }
    if (data.contactPhone && !validateTwPhone(data.contactPhone)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "聯絡窗口電話格式不正確（手機 09 開頭 10 碼，或市話格式）" });
    }
  };
}

// ─── 自動計算欄位輔助函數 ──────────────────────────────────────────────────────
/** 計算距今剩餘天數（正數=未來，負數=已過期） */
function daysFromToday(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** 計算下次體檢日期（最近體檢日 + 5 個月） */
function calcNextMedicalExamDate(lastDate: string | null | undefined): string | null {
  if (!lastDate) return null;
  const d = new Date(lastDate);
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + 5);
  return d.toISOString().slice(0, 10);
}

// ─── Routers ──────────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Dashboard（統計總覽）────────────────────────────────────────────────────
  dashboard: router({
    summary: publicProcedure.query(async () => {
      const [workers, customers, cases] = await Promise.all([
        getAllWorkers(),
        getAllCustomers(),
        getAllCases(),
      ]);

      // 依固定順序統計各狀態人數（沿用 schema enum 順序）
      const countBy = <T extends string>(rows: { [k: string]: any }[], field: string, order: readonly T[]) =>
        order.map(value => ({
          value,
          count: rows.filter(r => r[field] === value).length,
        }));

      const workersByLifecycle = countBy(workers, "lifecycleStatus",
        ["employed", "idle_in_tw", "preparing_abroad", "returned", "absconded"] as const);
      const casesByStatus = countBy(cases, "status",
        ["in_progress", "completed", "paused", "cancelled"] as const);
      const customersByType = countBy(customers, "employerType",
        ["individual", "company"] as const);

      // 證件到期：計算距今天數，含已過期（負值）與 60 天內即將到期；排除已結案者（已回國 / 逃跑）
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysUntil = (dateStr: string) => {
        const d = new Date(dateStr + "T00:00:00");
        return Math.round((d.getTime() - today.getTime()) / 86400000);
      };
      const CLOSED_STATUSES = ["returned", "absconded"];
      const EXPIRY_WINDOW_DAYS = 60;
      const expiringDocuments = workers
        .filter(w => !CLOSED_STATUSES.includes(w.lifecycleStatus))
        .flatMap(w => {
          const docs: { docType: "residentPermit" | "passport"; expiry: string }[] = [];
          if (w.residentPermitExpiry) docs.push({ docType: "residentPermit", expiry: w.residentPermitExpiry });
          if (w.passportExpiry) docs.push({ docType: "passport", expiry: w.passportExpiry });
          return docs.map(doc => ({
            workerId: w.id,
            name: w.name,
            docType: doc.docType,
            expiry: doc.expiry,
            daysLeft: daysUntil(doc.expiry),
          }));
        })
        .filter(d => d.daysLeft <= EXPIRY_WINDOW_DAYS)
        .sort((a, b) => a.daysLeft - b.daysLeft);

      return {
        totals: {
          workers: workers.length,
          customers: customers.length,
          cases: cases.length,
          employed: workers.filter(w => w.lifecycleStatus === "employed").length,
          expiringSoon: expiringDocuments.filter(d => d.daysLeft >= 0).length,
          expired: expiringDocuments.filter(d => d.daysLeft < 0).length,
        },
        workersByLifecycle,
        casesByStatus,
        customersByType,
        expiringDocuments,
      };
    }),
  }),

  // ─── Managers ──────────────────────────────────────────────────────────────
  managers: router({
    list: publicProcedure.query(async () => getAllManagers()),
    create: publicProcedure
      .input(z.object({ name: z.string().min(1, "名稱為必填").max(50).transform(s => s.trim()) }))
      .mutation(async ({ input }) => {
        await createManager({ name: input.name });
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteManager(input.id);
        return { success: true };
      }),
  }),

  // ─── Workers ───────────────────────────────────────────────────────────────
  workers: router({
    list: publicProcedure.query(async () => {
      const rows = await getAllWorkers();
      // 附加自動計算欄位
      return rows.map(w => ({
        ...w,
        residentPermitDaysLeft: daysFromToday(w.residentPermitExpiry),
        passportDaysLeft: daysFromToday(w.passportExpiry),
        nextMedicalExamDate: calcNextMedicalExamDate(w.lastMedicalExamDate),
        nextMedicalExamDaysLeft: daysFromToday(calcNextMedicalExamDate(w.lastMedicalExamDate)),
      }));
    }),
    getById: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const w = await getWorkerById(input.id);
        if (!w) throw new TRPCError({ code: "NOT_FOUND", message: "找不到此移工" });
        return {
          ...w,
          residentPermitDaysLeft: daysFromToday(w.residentPermitExpiry),
          passportDaysLeft: daysFromToday(w.passportExpiry),
          nextMedicalExamDate: calcNextMedicalExamDate(w.lastMedicalExamDate),
          nextMedicalExamDaysLeft: daysFromToday(calcNextMedicalExamDate(w.lastMedicalExamDate)),
        };
      }),
    create: publicProcedure
      .input(workerInput)
      .mutation(async ({ input }) => {
        await validateWorkerData(input)();
        const phone = input.phone ? normalizePhone(input.phone) : undefined;
        const newId = await createWorker({
          name: input.nameCn || input.nameEn || input.name,
          workerNo: input.workerNo || null,
          nameEn: input.nameEn || null,
          nameCn: input.nameCn || null,
          birthDate: input.birthDate || null,
          gender: input.gender || null,
          nationality: input.nationality || null,
          birthPlace: input.birthPlace || null,
          occupation: input.occupation || null,
          lifecycleStatus: input.lifecycleStatus,
          documentStatus: input.documentStatus,
          managerId: input.managerId,
          residentPermitNo: input.residentPermitNo || null,
          residentPermitExpiry: input.residentPermitExpiry || null,
          passportNo: input.passportNo || null,
          passportExpiry: input.passportExpiry || null,
          entryDate: input.entryDate || null,
          phone: phone || null,
          email: input.email || null,
          lastMedicalExamDate: input.lastMedicalExamDate || null,
          nextMedicalExamType: input.nextMedicalExamType || null,
          photoKey: input.photoKey || null,
          ktpKey: input.ktpKey || null,
          residentPermitFrontKey: input.residentPermitFrontKey || null,
          residentPermitBackKey: input.residentPermitBackKey || null,
          passportKey: input.passportKey || null,
          passportEntryKey: input.passportEntryKey || null,
          medicalReportKey: input.medicalReportKey || null,
          externalLink: input.externalLink || null,
          notes: input.notes || null,
        });
        return { success: true, id: newId };
      }),
    update: publicProcedure
      .input(z.object({ id: z.number().int().positive() }).merge(workerInput))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await validateWorkerData(data, id)();
        const phone = data.phone ? normalizePhone(data.phone) : undefined;
        await updateWorker(id, {
          name: data.nameCn || data.nameEn || data.name,
          workerNo: data.workerNo || null,
          nameEn: data.nameEn || null,
          nameCn: data.nameCn || null,
          birthDate: data.birthDate || null,
          gender: data.gender || null,
          nationality: data.nationality || null,
          birthPlace: data.birthPlace || null,
          occupation: data.occupation || null,
          lifecycleStatus: data.lifecycleStatus,
          documentStatus: data.documentStatus,
          managerId: data.managerId,
          residentPermitNo: data.residentPermitNo || null,
          residentPermitExpiry: data.residentPermitExpiry || null,
          passportNo: data.passportNo || null,
          passportExpiry: data.passportExpiry || null,
          entryDate: data.entryDate || null,
          phone: phone || null,
          email: data.email || null,
          lastMedicalExamDate: data.lastMedicalExamDate || null,
          nextMedicalExamType: data.nextMedicalExamType || null,
          photoKey: data.photoKey || null,
          ktpKey: data.ktpKey || null,
          residentPermitFrontKey: data.residentPermitFrontKey || null,
          residentPermitBackKey: data.residentPermitBackKey || null,
          passportKey: data.passportKey || null,
          passportEntryKey: data.passportEntryKey || null,
          medicalReportKey: data.medicalReportKey || null,
          externalLink: data.externalLink || null,
          notes: data.notes || null,
        });
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteWorker(input.id);
        return { success: true };
      }),

    // ── S3 檔案上傳 ──────────────────────────────────────────────────────────
    uploadFile: publicProcedure
      .input(z.object({
        workerId: z.number().int().positive(),
        fieldName: z.enum(["photoKey", "ktpKey", "residentPermitFrontKey", "residentPermitBackKey", "passportKey", "passportEntryKey", "medicalReportKey"]),
        fileName: z.string().max(200),
        fileBase64: z.string(), // base64 encoded file content
        mimeType: z.string().max(100),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const key = `workers/${input.workerId}/${input.fieldName}/${Date.now()}_${input.fileName}`;
        const { key: storedKey, url } = await storagePut(key, buffer, input.mimeType);
        // 更新 worker 對應欄位
        await updateWorker(input.workerId, { [input.fieldName]: storedKey });
        return { key: storedKey, url };
      }),

    // ── CSV 批次匯入 ─────────────────────────────────────────────────────────
    import: publicProcedure
      .input(z.object({ rows: z.array(workerInput) }))
      .mutation(async ({ input }) => {
        const results: { index: number; name: string; success: boolean; error?: string }[] = [];
        for (let i = 0; i < input.rows.length; i++) {
          const row = input.rows[i];
          try {
            await validateWorkerData(row)();
            const phone = row.phone ? normalizePhone(row.phone) : undefined;
            await createWorker({
              name: row.nameCn || row.nameEn || row.name,
              nameEn: row.nameEn || null,
              nameCn: row.nameCn || null,
              birthDate: row.birthDate || null,
              gender: row.gender || null,
              nationality: row.nationality || null,
              birthPlace: row.birthPlace || null,
              occupation: row.occupation || null,
              lifecycleStatus: row.lifecycleStatus,
              documentStatus: row.documentStatus,
              managerId: row.managerId,
              residentPermitNo: row.residentPermitNo || null,
              residentPermitExpiry: row.residentPermitExpiry || null,
              passportNo: row.passportNo || null,
              passportExpiry: row.passportExpiry || null,
              entryDate: row.entryDate || null,
              phone: phone || null,
              email: row.email || null,
              lastMedicalExamDate: row.lastMedicalExamDate || null,
              nextMedicalExamType: row.nextMedicalExamType || null,
              photoKey: null, ktpKey: null, residentPermitFrontKey: null,
              residentPermitBackKey: null, passportKey: null, passportEntryKey: null, medicalReportKey: null,
              externalLink: row.externalLink || null,
              notes: row.notes || null,
            });
            results.push({ index: i, name: row.name, success: true });
          } catch (err: any) {
            results.push({ index: i, name: row.name, success: false, error: err?.message || '未知錯誤' });
          }
        }
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        return { successCount, failCount, results };
      }),
  }),

  // ─── Customers ─────────────────────────────────────────────────────────────
  customers: router({
    list: publicProcedure.query(async () => getAllCustomers()),
    getById: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const customer = await getCustomerById(input.id);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "找不到此客戶" });
        return customer;
      }),
    create: publicProcedure
      .input(customerInput)
      .mutation(async ({ input }) => {
        await validateCustomerData(input)();
        if (!input.forceCreate) {
          const existingName = await getCustomerByName(input.name);
          if (existingName) throw new TRPCError({ code: "CONFLICT", message: "DUPLICATE_NAME:已存在同名客戶，確定要繼續建立嗎？" });
        }
        const contactPhone = input.contactPhone ? normalizePhone(input.contactPhone) : undefined;
        const phone = input.phone ? normalizePhone(input.phone) : undefined;
        const landline = input.landline ? normalizePhone(input.landline) : undefined;
        await createCustomer({
          employerType: input.employerType,
          name: input.name,
          employerNo: input.employerNo || null,
          phone: phone || null,
          landline: landline || null,
          address: input.address || null,
          registeredAddress: input.registeredAddress || null,
          referrer: input.referrer || null,
          idNo: input.idNo || null,
          preCourseNo: input.preCourseNo || null,
          idFrontKey: input.idFrontKey || null,
          idBackKey: input.idBackKey || null,
          careReceiverNo: input.careReceiverNo || null,
          careReceiverName: input.careReceiverName || null,
          careReceiverBirthDate: input.careReceiverBirthDate || null,
          careReceiverIdNo: input.careReceiverIdNo || null,
          careReceiverAddress: input.careReceiverAddress || null,
          careReceiverQualification: input.careReceiverQualification || null,
          careReceiverRelation: input.careReceiverRelation || null,
          careReceiverIdFrontKey: input.careReceiverIdFrontKey || null,
          careReceiverIdBackKey: input.careReceiverIdBackKey || null,
          taxId: input.taxId || null,
          industry: input.industry || null,
          contactName: input.contactName || null,
          contactPhone: contactPhone || null,
          caseNo: input.caseNo || null,
          caseStatus: input.caseStatus || null,
          jobSeekerType: input.jobSeekerType || null,
          jobSeekerDate: input.jobSeekerDate || null,
          jobSeekerFileKey: input.jobSeekerFileKey || null,
          recruitmentLetterType: input.recruitmentLetterType || null,
          recruitmentLetterDate: input.recruitmentLetterDate || null,
          recruitmentLetterFileKey: input.recruitmentLetterFileKey || null,
          recruitmentPermitNote: input.recruitmentPermitNote || null,
          recruitmentPermitDays: input.recruitmentPermitDays ?? null,
          previousWorkerDepartureDate: input.previousWorkerDepartureDate || null,
          employmentLetterType: input.employmentLetterType || null,
          employmentLetterDate: input.employmentLetterDate || null,
          employmentLetterFileKey: input.employmentLetterFileKey || null,
          approvedStartDate: input.approvedStartDate || null,
          approvedPeriod: input.approvedPeriod || null,
          approvedEndDate: input.approvedEndDate || null,
          contractStatus: input.contractStatus,
          pricingTier: input.pricingTier,
          managerId: input.managerId,
          notes: input.notes || null,
        });
        return { success: true };
      }),
    update: publicProcedure
      .input(z.object({ id: z.number().int().positive() }).merge(customerInput))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await validateCustomerData(data, id)();
        const contactPhone = data.contactPhone ? normalizePhone(data.contactPhone) : undefined;
        const phone = data.phone ? normalizePhone(data.phone) : undefined;
        const landline = data.landline ? normalizePhone(data.landline) : undefined;
        await updateCustomer(id, {
          employerType: data.employerType,
          name: data.name,
          employerNo: data.employerNo || null,
          phone: phone || null,
          landline: landline || null,
          address: data.address || null,
          registeredAddress: data.registeredAddress || null,
          referrer: data.referrer || null,
          idNo: data.idNo || null,
          preCourseNo: data.preCourseNo || null,
          idFrontKey: data.idFrontKey || null,
          idBackKey: data.idBackKey || null,
          careReceiverNo: data.careReceiverNo || null,
          careReceiverName: data.careReceiverName || null,
          careReceiverBirthDate: data.careReceiverBirthDate || null,
          careReceiverIdNo: data.careReceiverIdNo || null,
          careReceiverAddress: data.careReceiverAddress || null,
          careReceiverQualification: data.careReceiverQualification || null,
          careReceiverRelation: data.careReceiverRelation || null,
          careReceiverIdFrontKey: data.careReceiverIdFrontKey || null,
          careReceiverIdBackKey: data.careReceiverIdBackKey || null,
          taxId: data.taxId || null,
          industry: data.industry || null,
          contactName: data.contactName || null,
          contactPhone: contactPhone || null,
          caseNo: data.caseNo || null,
          caseStatus: data.caseStatus || null,
          jobSeekerType: data.jobSeekerType || null,
          jobSeekerDate: data.jobSeekerDate || null,
          jobSeekerFileKey: data.jobSeekerFileKey || null,
          recruitmentLetterType: data.recruitmentLetterType || null,
          recruitmentLetterDate: data.recruitmentLetterDate || null,
          recruitmentLetterFileKey: data.recruitmentLetterFileKey || null,
          recruitmentPermitNote: data.recruitmentPermitNote || null,
          recruitmentPermitDays: data.recruitmentPermitDays ?? null,
          previousWorkerDepartureDate: data.previousWorkerDepartureDate || null,
          employmentLetterType: data.employmentLetterType || null,
          employmentLetterDate: data.employmentLetterDate || null,
          employmentLetterFileKey: data.employmentLetterFileKey || null,
          approvedStartDate: data.approvedStartDate || null,
          approvedPeriod: data.approvedPeriod || null,
          approvedEndDate: data.approvedEndDate || null,
          contractStatus: data.contractStatus,
          pricingTier: data.pricingTier,
          managerId: data.managerId,
          notes: data.notes || null,
        });
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteCustomer(input.id);
        return { success: true };
      }),

        // ── S3 檔案上傳 ────────────────────────────────────────────────────────────────────────────────────
    uploadFile: publicProcedure
      .input(z.object({
        fieldName: z.enum(["idFrontKey", "idBackKey", "careReceiverIdFrontKey", "careReceiverIdBackKey", "jobSeekerFileKey", "recruitmentLetterFileKey", "employmentLetterFileKey"]),
        fileName: z.string().max(200),
        fileBase64: z.string(),
        mimeType: z.string().max(100),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const key = `customers/${input.fieldName}/${Date.now()}_${input.fileName}`;
        const { key: storedKey, url } = await storagePut(key, buffer, input.mimeType);
        return { key: storedKey, url };
      }),
    // ─── Care Receivers CRUD ───────────────────────────────────────────────────────────────────────────────
    careReceivers: router({
      listByCustomer: publicProcedure
        .input(z.object({ customerId: z.number().int().positive() }))
        .query(async ({ input }) => getCareReceiversByCustomerId(input.customerId)),
      create: publicProcedure
        .input(z.object({
          customerId: z.number().int().positive(),
          careReceiverNo: z.string().max(20).optional().nullable(),
          careReceiverName: z.string().max(50).optional().nullable(),
          careReceiverBirthDate: z.string().max(10).optional().nullable(),
          careReceiverIdNo: z.string().max(12).optional().nullable(),
          careReceiverAddress: z.string().max(200).optional().nullable(),
          careReceiverQualification: z.string().max(100).optional().nullable(),
          careReceiverRelation: z.string().max(50).optional().nullable(),
          careReceiverIdFrontKey: z.string().max(300).optional().nullable(),
          careReceiverIdBackKey: z.string().max(300).optional().nullable(),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => {
          const id = await createCareReceiver(input);
          return { id };
        }),
      update: publicProcedure
        .input(z.object({
          id: z.number().int().positive(),
          careReceiverNo: z.string().max(20).optional().nullable(),
          careReceiverName: z.string().max(50).optional().nullable(),
          careReceiverBirthDate: z.string().max(10).optional().nullable(),
          careReceiverIdNo: z.string().max(12).optional().nullable(),
          careReceiverAddress: z.string().max(200).optional().nullable(),
          careReceiverQualification: z.string().max(100).optional().nullable(),
          careReceiverRelation: z.string().max(50).optional().nullable(),
          careReceiverIdFrontKey: z.string().max(300).optional().nullable(),
          careReceiverIdBackKey: z.string().max(300).optional().nullable(),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...data } = input;
          await updateCareReceiver(id, data);
          return { success: true };
        }),
      delete: publicProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteCareReceiver(input.id);
          return { success: true };
        }),
    }),
    // ─── Customer Qualifications CRUD ─────────────────────────────────────────────────────────────────────
    qualifications: router({
      listByCustomer: publicProcedure
        .input(z.object({ customerId: z.number().int().positive() }))
        .query(async ({ input }) => getQualificationsByCustomerId(input.customerId)),
      create: publicProcedure
        .input(z.object({
          customerId: z.number().int().positive(),
          qualifierCategory: z.enum(['family','business']).default('family'),
          careReceiverId: z.number().int().positive().optional().nullable(),
          caseId: z.number().int().positive().optional().nullable(),
          label: z.string().max(100).optional().nullable(),
          caseNo: z.string().max(20).optional().nullable(),
          caseStatus: z.enum(['pending','processing','matched','completed','cancelled']).optional().nullable(),
          managerId: z.number().int().positive().optional().nullable(),
          jobSeekerType: z.enum(['new_hire','renewal','transfer','supplement']).optional().nullable(),
          jobSeekerDate: z.string().max(10).optional().nullable(),
          jobSeekerFileKey: z.string().max(300).optional().nullable(),
          recruitmentLetterType: z.enum(['domestic','overseas','both']).optional().nullable(),
          recruitmentLetterDate: z.string().max(10).optional().nullable(),
          recruitmentLetterFileKey: z.string().max(300).optional().nullable(),
          recruitmentPermitNote: z.string().optional().nullable(),
          recruitmentPermitDays: z.number().int().optional().nullable(),
          previousWorkerDepartureDate: z.string().max(10).optional().nullable(),
          employmentLetterType: z.enum(['initial','renewal','transfer']).optional().nullable(),
          employmentLetterDate: z.string().max(10).optional().nullable(),
          employmentLetterFileKey: z.string().max(300).optional().nullable(),
          approvedStartDate: z.string().max(10).optional().nullable(),
          approvedPeriod: z.string().max(50).optional().nullable(),
          approvedEndDate: z.string().max(10).optional().nullable(),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => {
          const id = await createCustomerQualification(input);
          return { id };
        }),
      update: publicProcedure
        .input(z.object({
          id: z.number().int().positive(),
          qualifierCategory: z.enum(['family','business']).optional(),
          careReceiverId: z.number().int().positive().optional().nullable(),
          caseId: z.number().int().positive().optional().nullable(),
          label: z.string().max(100).optional().nullable(),
          caseNo: z.string().max(20).optional().nullable(),
          caseStatus: z.enum(['pending','processing','matched','completed','cancelled']).optional().nullable(),
          managerId: z.number().int().positive().optional().nullable(),
          jobSeekerType: z.enum(['new_hire','renewal','transfer','supplement']).optional().nullable(),
          jobSeekerDate: z.string().max(10).optional().nullable(),
          jobSeekerFileKey: z.string().max(300).optional().nullable(),
          recruitmentLetterType: z.enum(['domestic','overseas','both']).optional().nullable(),
          recruitmentLetterDate: z.string().max(10).optional().nullable(),
          recruitmentLetterFileKey: z.string().max(300).optional().nullable(),
          recruitmentPermitNote: z.string().optional().nullable(),
          recruitmentPermitDays: z.number().int().optional().nullable(),
          previousWorkerDepartureDate: z.string().max(10).optional().nullable(),
          employmentLetterType: z.enum(['initial','renewal','transfer']).optional().nullable(),
          employmentLetterDate: z.string().max(10).optional().nullable(),
          employmentLetterFileKey: z.string().max(300).optional().nullable(),
          approvedStartDate: z.string().max(10).optional().nullable(),
          approvedPeriod: z.string().max(50).optional().nullable(),
          approvedEndDate: z.string().max(10).optional().nullable(),
          notes: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...data } = input;
          await updateCustomerQualification(id, data);
          return { success: true };
        }),
      delete: publicProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteCustomerQualification(input.id);
          return { success: true };
        }),
    }),
  }),

  // ─── Cases Router ─────────────────────────────────────────────────────
  cases: router({
    list: publicProcedure
      .input(z.object({
        customerId: z.number().int().positive().optional(),
        status: z.string().optional(),
        managerId: z.number().int().positive().optional(),
        search: z.string().optional(),
        orderBy: z.enum(["created_desc", "created_asc", "name"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        const rows = await getAllCases(input);
        if (rows.length === 0) return [];
        // 批次取得客戶、負責人、子表維度（消除 N+1）
        const caseIds = rows.map(c => c.id);
        const [allCustomers, allManagers, dimsMap] = await Promise.all([
          getAllCustomers(),
          getAllManagers(),
          getCaseDimensionsBatch(caseIds),
        ]);
        type CustomerRow = typeof allCustomers[0];
        type ManagerRow = typeof allManagers[0];
        const customerMap = new Map<number, CustomerRow>(allCustomers.map(c => [c.id, c]));
        const managerMap = new Map<number, ManagerRow>(allManagers.map(m => [m.id, m]));
        const orderBy = input?.orderBy ?? "created_desc";
        const enriched = rows.map((c) => {
          const dims = dimsMap.get(c.id) ?? { qualCount: 0, demandCount: 0, assignmentCount: 0, memberCount: 0 };
          return {
            ...c,
            customerName: customerMap.get(c.customerId)?.name ?? "",
            managerName: managerMap.get(c.managerId)?.name ?? "",
            ...dims,
          };
        });
        return enriched.sort((a, b) => {
          if (orderBy === "name") return a.name.localeCompare(b.name, "zh-TW");
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return orderBy === "created_desc" ? tb - ta : ta - tb;
        });
      }),
    getById: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const c = await getCaseById(input.id);
        if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "找不到此案件" });
        // 並行取得客戶、負責人、子表維度、主要移工（消除序列往返）
        const [customer, allManagers, dimsMap, primaryWorker] = await Promise.all([
          getCustomerById(c.customerId),
          getAllManagers(),
          getCaseDimensionsBatch([c.id]),
          c.primaryWorkerId ? getWorkerById(c.primaryWorkerId) : Promise.resolve(null),
        ]);
        const manager = allManagers.find(m => m.id === c.managerId);
        const dims = dimsMap.get(c.id) ?? { qualCount: 0, demandCount: 0, assignmentCount: 0, memberCount: 0 };
        return {
          ...c,
          customerName: customer?.name ?? "",
          managerName: manager?.name ?? "",
          // 雇主資料（自動帶入）
          customerPhone: customer?.phone ?? "",
          customerAddress: customer?.address ?? "",
          careReceiverName: customer?.careReceiverName ?? "",
          careReceiverQualification: customer?.careReceiverQualification ?? "",
          employerType: customer?.employerType ?? "",
          // 移工資料（自動帶入）
          workerNameCn: primaryWorker?.nameCn ?? primaryWorker?.name ?? "",
          workerNameEn: primaryWorker?.nameEn ?? "",
          workerResidentPermitNo: primaryWorker?.residentPermitNo ?? "",
          workerResidentPermitExpiry: primaryWorker?.residentPermitExpiry ?? "",
          workerPassportNo: primaryWorker?.passportNo ?? "",
          workerPassportExpiry: primaryWorker?.passportExpiry ?? "",
          workerPhone: primaryWorker?.phone ?? "",
          workerBirthPlace: primaryWorker?.birthPlace ?? "",
          workerNationality: primaryWorker?.nationality ?? "",
          ...dims,
        };
      }),
    create: publicProcedure
      .input(z.object({
        customerId: z.number().int().positive("客戶為必填"),
        name: z.string().min(2, "案件名稱至少 2 字").max(100).transform(s => s.trim()),
        managerId: z.number().int().positive("負責人為必填"),
        status: z.enum(["in_progress", "completed", "paused", "cancelled"]).default("in_progress"),
        caseCondition: z.string().max(100).optional().nullable().transform(s => s?.trim() || undefined),
        primaryWorkerId: z.number().int().positive().optional().nullable(),
        careReceiverId: z.number().int().positive().optional().nullable(),
        customerQualificationId: z.number().int().positive().optional().nullable(),
        needsReview: z.boolean().optional().nullable().transform(v => v ? 1 : 0),
        recruitmentPermitFileKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        // Phase 2: 脩僱時間
        continuousEmploymentDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        employmentPeriodMonths: z.number().int().min(1).max(36).optional().nullable(),
        terminationDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        // Phase 2: 代辦事項
        recruitmentAgencyItems: z.enum(["none", "self", "agency"]).optional().nullable().transform(v => v ?? undefined),
        employmentAgencyItems: z.enum(["none", "self", "agency"]).optional().nullable().transform(v => v ?? undefined),
        postEmploymentInsurance: z.enum(["none", "health", "accident", "both"]).optional().nullable().transform(v => v ?? undefined),
        // Phase 2: 脩僱許可函與情況
        employmentPermitFileKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        employmentStatus: z.enum(["normal", "suspended", "terminated", "transferred"]).optional().nullable().transform(v => v ?? undefined),
        terminationLetterFileKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        // Phase 3: 承接通報/入國通報
        notificationNo: z.string().max(50).optional().nullable().transform(s => s?.trim() || undefined),
        entryNotificationDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        certificateNo: z.string().max(50).optional().nullable().transform(s => s?.trim() || undefined),
        // Phase 3: 內政部移民署
        niaCategory: z.string().max(50).optional().nullable().transform(s => s?.trim() || undefined),
        niaNo: z.string().max(50).optional().nullable().transform(s => s?.trim() || undefined),
        residencePermitSubmitDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        // Phase 3: 勞動部脩僱許可函
        molReceiptNo: z.string().max(50).optional().nullable().transform(s => s?.trim() || undefined),
        employmentLetterCategory: z.string().max(50).optional().nullable().transform(s => s?.trim() || undefined),
        applicationSubmitDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        issuanceDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        approvalReceiptDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        // Phase 4: 保險管理
        healthInsurance: z.string().max(200).optional().nullable().transform(s => s?.trim() || undefined),
        healthInsurancePolicyKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        accidentInsurance: z.string().max(200).optional().nullable().transform(s => s?.trim() || undefined),
        accidentInsurancePolicyKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        // Phase 4: 體檢管理
        prevMedicalExamDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        prevMedicalReportKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        entryMedicalExamDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        entryMedicalReportKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        exam6mDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        exam6mReportKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        exam18mDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        exam18mReportKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        exam30mDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        exam30mReportKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        notes: z.string().optional().nullable().transform(s => s?.trim() || undefined),
      }))
      .mutation(async ({ input }) => {
        // 自動產生案件編號：GVC25-YYYYMMDD-NNN
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
        const allCases = await getAllCases();
        const todayCases = allCases.filter(c => c.caseNo?.includes(dateStr));
        const seq = String(todayCases.length + 1).padStart(3, "0");
        const caseNo = `GVC25-${dateStr}-${seq}`;
        await createCase({ ...input, caseNo });
        return { success: true, caseNo };
      }),
    update: publicProcedure
      .input(z.object({
        id: z.number().int().positive(),
        customerId: z.number().int().positive("客戶為必填"),
        name: z.string().min(2, "案件名稱至少 2 字").max(100).transform(s => s.trim()),
        managerId: z.number().int().positive("負責人為必填"),
        status: z.enum(["in_progress", "completed", "paused", "cancelled"]),
        caseCondition: z.string().max(100).optional().transform(s => s?.trim() || undefined),
        primaryWorkerId: z.number().int().positive().optional().nullable(),
        careReceiverId: z.number().int().positive().optional().nullable(),
        customerQualificationId: z.number().int().positive().optional().nullable(),
        needsReview: z.boolean().optional().transform(v => v ? 1 : 0),
        recruitmentPermitFileKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        // Phase 2: 聘僱時間
        continuousEmploymentDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        employmentPeriodMonths: z.number().int().min(1).max(36).optional().nullable(),
        terminationDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        // Phase 2: 代辦事項
        recruitmentAgencyItems: z.enum(["none", "self", "agency"]).optional().nullable(),
        employmentAgencyItems: z.enum(["none", "self", "agency"]).optional().nullable(),
        postEmploymentInsurance: z.enum(["none", "health", "accident", "both"]).optional().nullable(),
        // Phase 2: 聘僱許可函與情況
        employmentPermitFileKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        employmentStatus: z.enum(["normal", "suspended", "terminated", "transferred"]).optional().nullable(),
        terminationLetterFileKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        // Phase 3: 承接通報/入國通報
        notificationNo: z.string().max(50).optional().nullable().transform(s => s?.trim() || undefined),
        entryNotificationDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        certificateNo: z.string().max(50).optional().nullable().transform(s => s?.trim() || undefined),
        // Phase 3: 內政部移民署
        niaCategory: z.string().max(50).optional().nullable().transform(s => s?.trim() || undefined),
        niaNo: z.string().max(50).optional().nullable().transform(s => s?.trim() || undefined),
        residencePermitSubmitDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        // Phase 3: 勞動部聘僱許可函
        molReceiptNo: z.string().max(50).optional().nullable().transform(s => s?.trim() || undefined),
        employmentLetterCategory: z.string().max(50).optional().nullable().transform(s => s?.trim() || undefined),
        applicationSubmitDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        issuanceDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        approvalReceiptDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        // Phase 4: 保險管理
        healthInsurance: z.string().max(200).optional().nullable().transform(s => s?.trim() || undefined),
        healthInsurancePolicyKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        accidentInsurance: z.string().max(200).optional().nullable().transform(s => s?.trim() || undefined),
        accidentInsurancePolicyKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        // Phase 4: 體檢管理
        prevMedicalExamDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        prevMedicalReportKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        entryMedicalExamDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        entryMedicalReportKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        exam6mDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        exam6mReportKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        exam18mDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        exam18mReportKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        exam30mDate: z.string().max(10).optional().nullable().transform(s => s?.trim() || undefined),
        exam30mReportKey: z.string().max(300).optional().nullable().transform(s => s?.trim() || undefined),
        notes: z.string().optional().transform(s => s?.trim() || undefined),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateCase(id, data);
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteCase(input.id);
        return { success: true };
      }),
    getChildCounts: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => getCaseChildCounts(input.id)),
  }),

  // ─── Case Qualifications Router ───────────────────────────────────────────
  caseQualifications: router({
    listByCase: publicProcedure
      .input(z.object({ caseId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const quals = await getQualificationsByCaseId(input.caseId);
        if (quals.length === 0) return [];
        // 批次取得所有資格的 quotaUsed（消除 N×2 查詢）
        const qualIds = quals.map(q => q.id);
        const quotaUsedMap = await getQuotaUsedBatch(qualIds);
        return quals.map(q => {
          const quotaUsed = quotaUsedMap.get(q.id) ?? 0;
          return { ...q, quotaUsed, quotaRemaining: q.quotaTotal - quotaUsed };
        });
      }),
    getById: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const q = await getQualificationById(input.id);
        if (!q) throw new TRPCError({ code: "NOT_FOUND", message: "找不到此資格" });
        const quotaUsed = await getQuotaUsed(q.id);
        return { ...q, quotaUsed, quotaRemaining: q.quotaTotal - quotaUsed };
      }),
    create: publicProcedure
      .input(z.object({
        caseId: z.number().int().positive(),
        label: z.string().min(1).max(100).transform(s => s.trim()),
        category: z.enum(["labor_in", "labor_out", "professional"]),
        qualType: z.enum(["caregiver", "domestic_helper", "manufacturing", "agriculture", "construction", "white_collar", "intermediate", "overseas_student"]),
        employerName: z.string().max(100).optional().transform(s => s?.trim() || undefined),
        employerTaxId: z.string().max(8).optional().transform(s => s?.trim() || undefined),
        employerNote: z.string().optional().transform(s => s?.trim() || undefined),
        applicationStatus: z.enum(["preparing", "submitted", "reviewing", "approved", "supplement", "rejected"]).default("preparing"),
        expectedApprovalDate: z.string().optional(),
        quotaTotal: z.number().int().min(0).default(0),
        docValidUntil: z.string().optional(),
        notes: z.string().optional().transform(s => s?.trim() || undefined),
      }))
      .mutation(async ({ input }) => {
        await createQualification(input);
        return { success: true };
      }),
    update: publicProcedure
      .input(z.object({
        id: z.number().int().positive(),
        label: z.string().min(1).max(100).transform(s => s.trim()),
        category: z.enum(["labor_in", "labor_out", "professional"]),
        qualType: z.enum(["caregiver", "domestic_helper", "manufacturing", "agriculture", "construction", "white_collar", "intermediate", "overseas_student"]),
        employerName: z.string().max(100).optional().transform(s => s?.trim() || undefined),
        employerTaxId: z.string().max(8).optional().transform(s => s?.trim() || undefined),
        employerNote: z.string().optional().transform(s => s?.trim() || undefined),
        applicationStatus: z.enum(["preparing", "submitted", "reviewing", "approved", "supplement", "rejected"]),
        expectedApprovalDate: z.string().optional(),
        quotaTotal: z.number().int().min(0),
        docValidUntil: z.string().optional(),
        notes: z.string().optional().transform(s => s?.trim() || undefined),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateQualification(id, data);
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteQualification(input.id);
        return { success: true };
      }),
  }),

  // ─── Case Demands Router ──────────────────────────────────────────────────
  caseDemands: router({
    listByCase: publicProcedure
      .input(z.object({ caseId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const demands = await getDemandsByCaseId(input.caseId);
        if (demands.length === 0) return [];
        const progressMap = await getDemandProgressBatch(demands.map(d => d.id));
        return demands.map(d => {
          const { matchedCount, employedCount } = progressMap.get(d.id) ?? { matchedCount: 0, employedCount: 0 };
          const progress = d.neededCount > 0 ? Math.round((matchedCount / d.neededCount) * 100) : 0;
          return { ...d, matchedCount, employedCount, progress };
        });
      }),
    create: publicProcedure
      .input(z.object({
        caseId: z.number().int().positive(),
        label: z.string().min(1).max(100).transform(s => s.trim()),
        qualificationId: z.number().int().positive().optional(),
        qualType: z.enum(["caregiver", "domestic_helper", "manufacturing", "agriculture", "construction", "white_collar", "intermediate", "overseas_student"]),
        neededCount: z.number().int().min(1),
        status: z.enum(["open", "filling", "fulfilled", "closed"]).default("open"),
        notes: z.string().optional().transform(s => s?.trim() || undefined),
      }))
      .mutation(async ({ input }) => {
        await createDemand(input);
        return { success: true };
      }),
    update: publicProcedure
      .input(z.object({
        id: z.number().int().positive(),
        label: z.string().min(1).max(100).transform(s => s.trim()),
        qualificationId: z.number().int().positive().optional(),
        qualType: z.enum(["caregiver", "domestic_helper", "manufacturing", "agriculture", "construction", "white_collar", "intermediate", "overseas_student"]),
        neededCount: z.number().int().min(1),
        status: z.enum(["open", "filling", "fulfilled", "closed"]),
        notes: z.string().optional().transform(s => s?.trim() || undefined),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateDemand(id, data);
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteDemand(input.id);
        return { success: true };
      }),
  }),

  // ─── Case Assignments Router ──────────────────────────────────────────────
  caseAssignments: router({
    listByCase: publicProcedure
      .input(z.object({ caseId: z.number().int().positive(), stage: z.string().optional() }))
      .query(async ({ input }) => {
        const [assignments, allMembers, allWorkers] = await Promise.all([
          getAssignmentsByCaseId(input.caseId),
          getMembersByCaseId(input.caseId),
          getAllWorkers(),
        ]);
        const workerMap = new Map(allWorkers.map(w => [w.id, w]));
        // 依 assignmentId 分組成員（一次查詢取代逐一查詢，消除 N+1）
        const membersByAssignment = new Map<number, typeof allMembers>();
        for (const m of allMembers) {
          const list = membersByAssignment.get(m.assignmentId) ?? [];
          list.push(m);
          membersByAssignment.set(m.assignmentId, list);
        }
        return assignments.map(a => {
          const members = membersByAssignment.get(a.id) ?? [];
          const enrichedMembers = members
            .filter(m => !input.stage || m.stage === input.stage)
            .map(m => ({
              ...m,
              workerName: workerMap.get(m.workerId)?.name ?? "",
              workerNameEn: workerMap.get(m.workerId)?.nameEn ?? "",
              workerNationality: workerMap.get(m.workerId)?.nationality ?? "",
              workerPermitNo: workerMap.get(m.workerId)?.residentPermitNo ?? workerMap.get(m.workerId)?.passportNo ?? "",
              workerLifecycleStatus: workerMap.get(m.workerId)?.lifecycleStatus ?? "",
            }));
          return { ...a, members: enrichedMembers };
        });
      }),
    create: publicProcedure
      .input(z.object({
        caseId: z.number().int().positive(),
        label: z.string().max(100).optional(),
        demandId: z.number().int().positive().optional(),
        qualificationId: z.number().int().positive().optional(),
        batchNote: z.string().optional(),
        notes: z.string().optional(),
        workerIds: z.array(z.number().int().positive()).min(1, "至少選擇一位移工"),
      }))
      .mutation(async ({ input }) => {
        const { workerIds, ...assignmentData } = input;
        // 唯一性檢查：同案件同移工只能一筆非終態成員
        const existingMembers = await getMembersByCaseId(input.caseId);
        const activeStages = ['candidate', 'confirmed', 'upcoming', 'employed'];
        const activeWorkerIds = new Set(existingMembers.filter(m => activeStages.includes(m.stage)).map(m => m.workerId));
        const conflicts = workerIds.filter(wid => activeWorkerIds.has(wid));
        if (conflicts.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: `此移工已在本案件配對中（workerId: ${conflicts.join(", ")}）` });
        }
        // 建立配對
        const assignmentId = await createAssignment(assignmentData);
        // 建立成員
        for (const workerId of workerIds) {
          await createMember({ assignmentId, caseId: input.caseId, workerId, stage: "candidate" });
        }
        return { success: true, assignmentId };
      }),
    update: publicProcedure
      .input(z.object({
        id: z.number().int().positive(),
        label: z.string().max(100).optional(),
        demandId: z.number().int().positive().optional(),
        qualificationId: z.number().int().positive().optional(),
        batchNote: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateAssignment(id, data);
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteAssignment(input.id);
        return { success: true };
      }),
    addWorker: publicProcedure
      .input(z.object({
        assignmentId: z.number().int().positive(),
        workerId: z.number().int().positive(),
      }))
      .mutation(async ({ input }) => {
        const assignment = await getAssignmentById(input.assignmentId);
        if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "找不到此配對" });
        const existingMembers = await getMembersByCaseId(assignment.caseId);
        const activeStages = ['candidate', 'confirmed', 'upcoming', 'employed'];
        const conflict = existingMembers.find(m => m.workerId === input.workerId && activeStages.includes(m.stage));
        if (conflict) throw new TRPCError({ code: "CONFLICT", message: "此移工已在本案件配對中" });
        await createMember({ assignmentId: input.assignmentId, caseId: assignment.caseId, workerId: input.workerId, stage: "candidate" });
        return { success: true };
      }),
    updateMember: publicProcedure
      .input(z.object({
        memberId: z.number().int().positive(),
        matchNote: z.string().optional(),
        expectedDocDate: z.string().optional(),
        expectedEntryDate: z.string().optional(),
        departureNote: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { memberId, ...data } = input;
        await updateMember(memberId, data);
        return { success: true };
      }),
    updateMemberStage: publicProcedure
      .input(z.object({
        memberId: z.number().int().positive(),
        stage: z.enum(["candidate", "confirmed", "upcoming", "employed", "departed", "rejected"]),
      }))
      .mutation(async ({ input }) => {
        await updateMember(input.memberId, { stage: input.stage });
        return { success: true };
      }),
    removeWorker: publicProcedure
      .input(z.object({ memberId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteMember(input.memberId);
        return { success: true };
      }),
    workerInvolvements: publicProcedure
      .input(z.object({ excludeCaseId: z.number().int().positive().optional() }))
      .query(async ({ input }) => {
        const members = await getWorkerInvolvements(input.excludeCaseId);
        const allCases = await getAllCases();
        const allCustomers = await getAllCustomers();
        const allWorkers = await getAllWorkers();
        const caseMap = new Map(allCases.map(c => [c.id, c]));
        const customerMap = new Map(allCustomers.map(c => [c.id, c]));
        const workerMap = new Map(allWorkers.map(w => [w.id, w]));
        return members.map(m => {
          const caseItem = caseMap.get(m.caseId);
          const customerId = caseItem?.customerId ?? 0;
          const workerItem = workerMap.get(m.workerId);
          return {
            workerId: m.workerId,
            workerName: workerItem?.nameCn || workerItem?.nameEn || workerItem?.name || "",
            caseId: m.caseId,
            caseName: caseItem?.name ?? "",
            customerId,
            customerName: customerMap.get(customerId)?.name ?? "",
            stage: m.stage,
          };
        });
      }),
    getMembersByCaseId: publicProcedure
      .input(z.object({ caseId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const members = await getMembersByCaseId(input.caseId);
        const allWorkers = await getAllWorkers();
        const workerMap = new Map(allWorkers.map(w => [w.id, w]));
        return members.map(m => ({
          ...m,
          workerName: workerMap.get(m.workerId)?.name ?? "",
          workerNameEn: workerMap.get(m.workerId)?.nameEn ?? "",
          workerNationality: workerMap.get(m.workerId)?.nationality ?? "",
          workerPermitNo: workerMap.get(m.workerId)?.residentPermitNo ?? workerMap.get(m.workerId)?.passportNo ?? "",
          workerLifecycleStatus: workerMap.get(m.workerId)?.lifecycleStatus ?? "",
        }));
      }),
  }),
  caseEmployments: router({
    listByCase: publicProcedure
      .input(z.object({ caseId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const emps = await getEmploymentsByCase(input.caseId);
        const allWorkers = await getAllWorkers();
        const quals = await getQualificationsByCaseId(input.caseId);
        const workerMap = new Map(allWorkers.map(w => [w.id, w]));
        const qualMap = new Map(quals.map((q: { id: number; label: string }) => [q.id, q]));
        return emps.map(e => ({
          ...e,
          workerName: workerMap.get(e.workerId)?.name ?? "",
          workerNameEn: workerMap.get(e.workerId)?.nameEn ?? "",
          qualificationLabel: e.qualificationId ? (qualMap.get(e.qualificationId) as any)?.label ?? "" : "",
        }));
      }),
    create: publicProcedure
      .input(z.object({
        caseId: z.number().int().positive(),
        workerId: z.number().int().positive(),
        qualificationId: z.number().int().positive().optional(),
        position: z.string().max(100).optional(),
        contractStart: z.string().max(10).optional(),
        contractEnd: z.string().max(10).optional(),
        status: z.enum(["pending", "active", "terminated", "expired"]).default("pending"),
        terminationReason: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await createEmployment({
          caseId: input.caseId,
          workerId: input.workerId,
          qualificationId: input.qualificationId ?? null,
          position: input.position ?? null,
          contractStart: input.contractStart ?? null,
          contractEnd: input.contractEnd ?? null,
          status: input.status,
          terminationReason: input.terminationReason ?? null,
          notes: input.notes ?? null,
        });
        return { success: true };
      }),
    update: publicProcedure
      .input(z.object({
        id: z.number().int().positive(),
        workerId: z.number().int().positive().optional(),
        qualificationId: z.number().int().positive().optional(),
        position: z.string().max(100).optional(),
        contractStart: z.string().max(10).optional(),
        contractEnd: z.string().max(10).optional(),
        status: z.enum(["pending", "active", "terminated", "expired"]).optional(),
        terminationReason: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateEmployment(id, {
          ...data,
          qualificationId: data.qualificationId ?? null,
          position: data.position ?? null,
          contractStart: data.contractStart ?? null,
          contractEnd: data.contractEnd ?? null,
          terminationReason: data.terminationReason ?? null,
          notes: data.notes ?? null,
        });
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteEmployment(input.id);
        return { success: true };
      }),
  }),
});
export type AppRouter = typeof appRouter;
