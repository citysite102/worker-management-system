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
} from "./db";
import { storagePut } from "./storage";
import {
  validateTwPhone, normalizePhone, validateResidentPermit, validatePassport, validateTaxId, validateNotFutureDate,
} from "../shared/validation";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const workerInput = z.object({
  // 基本資料
  name: z.string().min(1, "姓名為必填").max(100).transform(s => s.trim()),
  nameEn: z.string().max(100).optional().transform(s => s?.trim() || undefined),
  nameCn: z.string().max(50).optional().transform(s => s?.trim() || undefined),
  birthDate: z.string().optional().transform(s => s?.trim() || undefined),
  gender: z.enum(["male", "female", "other"]).optional(),
  nationality: z.string().max(50).optional().transform(s => s?.trim() || undefined),
  birthPlace: z.string().max(100).optional().transform(s => s?.trim() || undefined),
  occupation: z.enum(["caregiver_family", "caregiver_hospital", "manufacturing", "construction", "agriculture", "fishery", "other"]).optional(),
  // 狀態
  lifecycleStatus: z.enum(["recruiting", "document_processing", "employed", "pending_renewal", "departed"]),
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
  name: z.string().min(2, "名稱至少 2 字").max(50, "名稱最多 50 字").transform(s => s.trim()),
  taxId: z.string().optional().transform(s => s?.trim() || undefined),
  industry: z.string().max(50).optional().transform(s => s?.trim() || undefined),
  contractStatus: z.enum(["negotiating", "signed", "in_service", "pending_renewal", "ended"]),
  pricingTier: z.enum(["standard", "custom"]),
  managerId: z.number().int().positive("負責人為必填"),
  contactName: z.string().max(50).optional().transform(s => s?.trim() || undefined),
  contactPhone: z.string().optional().transform(s => s?.trim() || undefined),
  notes: z.string().optional().transform(s => s?.trim() || undefined),
  forceCreate: z.boolean().optional(),
});

// ─── Worker Validation Helper ─────────────────────────────────────────────────
function validateWorkerData(data: z.infer<typeof workerInput>, excludeId?: number) {
  return async () => {
    // 居留證格式
    if (data.residentPermitNo) {
      if (!validateResidentPermit(data.residentPermitNo)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "居留證統一證號格式不正確（應為 1 英文字母 + 1 或 2 + 8 位數字）" });
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
        await createCustomer({
          name: input.name, taxId: input.taxId || null, industry: input.industry || null,
          contractStatus: input.contractStatus, pricingTier: input.pricingTier, managerId: input.managerId,
          contactName: input.contactName || null, contactPhone: contactPhone || null, notes: input.notes || null,
        });
        return { success: true };
      }),
    update: publicProcedure
      .input(z.object({ id: z.number().int().positive() }).merge(customerInput))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await validateCustomerData(data, id)();
        const contactPhone = data.contactPhone ? normalizePhone(data.contactPhone) : undefined;
        await updateCustomer(id, {
          name: data.name, taxId: data.taxId || null, industry: data.industry || null,
          contractStatus: data.contractStatus, pricingTier: data.pricingTier, managerId: data.managerId,
          contactName: data.contactName || null, contactPhone: contactPhone || null, notes: data.notes || null,
        });
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteCustomer(input.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
