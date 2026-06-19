import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getAllManagers, createManager, deleteManager,
  getAllWorkers, getWorkerById, getWorkerByIdNumber, createWorker, updateWorker, deleteWorker,
  getAllCustomers, getCustomerById, getCustomerByTaxId, getCustomerByName, createCustomer, updateCustomer, deleteCustomer,
} from "./db";
import {
  validateTwPhone, normalizePhone, validateResidentPermit, validatePassport, validateTaxId, validateNotFutureDate,
} from "../shared/validation";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────
const workerInput = z.object({
  name: z.string().min(2, "姓名至少 2 字").max(50, "姓名最多 50 字").transform(s => s.trim()),
  nationality: z.string().max(50).optional().transform(s => s?.trim() || undefined),
  idType: z.enum(["resident_permit", "passport"]),
  idNumber: z.string().min(1, "證號為必填").transform(s => s.trim()),
  lifecycleStatus: z.enum(["recruiting", "document_processing", "employed", "pending_renewal", "departed"]),
  documentStatus: z.enum(["not_started", "pending_supplement", "expiring_soon", "complete"]),
  managerId: z.number().int().positive("負責人為必填"),
  phone: z.string().optional().transform(s => s?.trim() || undefined),
  entryDate: z.string().optional().transform(s => s?.trim() || undefined),
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
    // 證號格式驗證
    if (data.idType === "resident_permit") {
      if (!validateResidentPermit(data.idNumber)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "居留證統一證號格式不正確（應為 1 英文字母 + 1 或 2 + 8 位數字）" });
      }
    } else {
      if (!validatePassport(data.idNumber)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "護照號碼格式不正確（應為 6-9 碼英數字）" });
      }
    }
    // 電話格式
    if (data.phone) {
      if (!validateTwPhone(data.phone)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "電話格式不正確（手機 09 開頭 10 碼，或市話格式）" });
      }
    }
    // 入境日期
    if (data.entryDate) {
      if (!validateNotFutureDate(data.entryDate)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "入境日期不可晚於今天" });
      }
    }
    // 跨欄位邏輯：在職時文件狀態不可為未啟動或待補件
    if (data.lifecycleStatus === "employed" && (data.documentStatus === "not_started" || data.documentStatus === "pending_supplement")) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "在職移工的文件狀態不應為未完成，請確認" });
    }
    // 唯一性檢查
    const existing = await getWorkerByIdNumber(data.idNumber, excludeId);
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: "此證號已存在，請確認是否重複建檔" });
    }
  };
}

// ─── Customer Validation Helper ───────────────────────────────────────────────
function validateCustomerData(data: z.infer<typeof customerInput>, excludeId?: number) {
  return async () => {
    // 統一編號格式
    if (data.taxId) {
      if (!validateTaxId(data.taxId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "統一編號格式不正確" });
      }
      // 統編唯一性
      const existingTaxId = await getCustomerByTaxId(data.taxId, excludeId);
      if (existingTaxId) {
        throw new TRPCError({ code: "CONFLICT", message: "此統一編號已存在，請確認是否重複建檔" });
      }
    }
    // 電話格式
    if (data.contactPhone) {
      if (!validateTwPhone(data.contactPhone)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "聯絡窗口電話格式不正確（手機 09 開頭 10 碼，或市話格式）" });
      }
    }
  };
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
    list: publicProcedure.query(async () => {
      return getAllManagers();
    }),
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
      return getAllWorkers();
    }),
    getById: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const worker = await getWorkerById(input.id);
        if (!worker) throw new TRPCError({ code: "NOT_FOUND", message: "找不到此移工" });
        return worker;
      }),
    create: publicProcedure
      .input(workerInput)
      .mutation(async ({ input }) => {
        await validateWorkerData(input)();
        const phone = input.phone ? normalizePhone(input.phone) : undefined;
        await createWorker({
          name: input.name,
          nationality: input.nationality || null,
          idType: input.idType,
          idNumber: input.idNumber,
          lifecycleStatus: input.lifecycleStatus,
          documentStatus: input.documentStatus,
          managerId: input.managerId,
          phone: phone || null,
          entryDate: input.entryDate || null,
          notes: input.notes || null,
        });
        return { success: true };
      }),
    update: publicProcedure
      .input(z.object({ id: z.number().int().positive() }).merge(workerInput))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await validateWorkerData(data, id)();
        const phone = data.phone ? normalizePhone(data.phone) : undefined;
        await updateWorker(id, {
          name: data.name,
          nationality: data.nationality || null,
          idType: data.idType,
          idNumber: data.idNumber,
          lifecycleStatus: data.lifecycleStatus,
          documentStatus: data.documentStatus,
          managerId: data.managerId,
          phone: phone || null,
          entryDate: data.entryDate || null,
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
  }),

  // ─── Customers ─────────────────────────────────────────────────────────────
  customers: router({
    list: publicProcedure.query(async () => {
      return getAllCustomers();
    }),
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
        // 同名警告（非強制時返回警告，強制時繼續）
        if (!input.forceCreate) {
          const existingName = await getCustomerByName(input.name);
          if (existingName) {
            throw new TRPCError({ code: "CONFLICT", message: "DUPLICATE_NAME:已存在同名客戶，確定要繼續建立嗎？" });
          }
        }
        const contactPhone = input.contactPhone ? normalizePhone(input.contactPhone) : undefined;
        await createCustomer({
          name: input.name,
          taxId: input.taxId || null,
          industry: input.industry || null,
          contractStatus: input.contractStatus,
          pricingTier: input.pricingTier,
          managerId: input.managerId,
          contactName: input.contactName || null,
          contactPhone: contactPhone || null,
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
        await updateCustomer(id, {
          name: data.name,
          taxId: data.taxId || null,
          industry: data.industry || null,
          contractStatus: data.contractStatus,
          pricingTier: data.pricingTier,
          managerId: data.managerId,
          contactName: data.contactName || null,
          contactPhone: contactPhone || null,
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
  }),
});

export type AppRouter = typeof appRouter;
