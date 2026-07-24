// ─── managers 子路由（負責人 CRUD）──────────────────────────────────────────────
// 從 server/routers.ts 拆出的 per-domain 路由（架構深化 C）。
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, staffProcedure } from "../_core/trpc";
import {
  getAllManagers,
  createManager,
  countDependentsByManager,
  deleteManager,
} from "../db";

export const managersRouter = router({
  list: staffProcedure.query(async () => getAllManagers()),
  create: staffProcedure
    .input(z.object({ name: z.string().trim().min(1, "名稱為必填").max(50) }))
    .mutation(async ({ input }) => {
      const id = await createManager({ name: input.name });
      return { success: true, id };
    }),
  delete: staffProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      // 還有東西指派給這位負責人就不許刪。資料庫層的 FK 也會擋，但那會噴出
      // 使用者看不懂的原始 SQL 錯誤，所以這裡先給可讀的訊息。
      const deps = await countDependentsByManager(input.id);
      const parts = [
        deps.workers > 0 ? `${deps.workers} 位移工` : null,
        deps.customers > 0 ? `${deps.customers} 個雇主` : null,
        deps.cases > 0 ? `${deps.cases} 個案件` : null,
      ].filter(Boolean);
      if (parts.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `此負責人名下還有 ${parts.join("、")}，請先改派後再刪除`,
        });
      }
      await deleteManager(input.id);
      return { success: true };
    }),
});
