// ─── reconcile 子路由（公開履歷 ↔ 名冊移工 勾稽）────────────────────────────────
// 從 server/routers.ts 拆出的 per-domain 路由（架構深化 C）。
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, staffProcedure } from "../_core/trpc";
import { logAudit } from "../_core/audit";
import {
  getAllProfiles,
  getUserById,
  getWorkerById,
  getEmploymentsByWorker,
  searchWorkersForReconcile,
  getProfileById,
  setProfileWorkerLink,
} from "../db";

export const reconcileRouter = router({
  // 所有公開履歷 + 帳號資訊 + 目前連結的名冊移工（含其平台紀錄筆數）
  profiles: staffProcedure.query(async () => {
    const rows = await getAllProfiles();
    return Promise.all(
      rows.map(async p => {
        const [u, linkedWorker] = await Promise.all([
          getUserById(p.userId),
          p.workerId ? getWorkerById(p.workerId) : Promise.resolve(undefined),
        ]);
        const records = p.workerId
          ? await getEmploymentsByWorker(p.workerId)
          : [];
        return {
          id: p.id,
          alias: p.alias,
          nationality: p.nationality,
          jobType: p.jobType,
          moderationStatus: p.moderationStatus,
          publishStatus: p.publishStatus,
          accountEmail: u?.email ?? null,
          accountName: u?.name ?? null,
          workerId: p.workerId,
          linkedWorkerName: linkedWorker
            ? (linkedWorker.nameCn ?? linkedWorker.nameEn ?? linkedWorker.name)
            : null,
          recordCount: records.length,
        };
      })
    );
  }),
  // 以姓名/證號搜尋既有名冊（供選擇要連結的移工）
  searchWorkers: staffProcedure
    .input(z.object({ query: z.string().trim().min(1).max(50) }))
    .query(async ({ input }) => searchWorkersForReconcile(input.query)),
  // 連結：把公開履歷連到既有名冊 workers.id
  link: staffProcedure
    .input(
      z.object({
        profileId: z.number().int().positive(),
        workerId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [profile, worker] = await Promise.all([
        getProfileById(input.profileId),
        getWorkerById(input.workerId),
      ]);
      if (!profile)
        throw new TRPCError({ code: "NOT_FOUND", message: "找不到此履歷" });
      if (!worker)
        throw new TRPCError({ code: "NOT_FOUND", message: "找不到此移工" });
      await setProfileWorkerLink(input.profileId, input.workerId);
      await logAudit(ctx, {
        action: "reconcile.link",
        entityType: "worker_public_profiles",
        entityId: input.profileId,
        meta: { workerId: input.workerId },
      });
      return { success: true } as const;
    }),
  // 解除連結
  unlink: staffProcedure
    .input(z.object({ profileId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await getProfileById(input.profileId);
      if (!profile)
        throw new TRPCError({ code: "NOT_FOUND", message: "找不到此履歷" });
      await setProfileWorkerLink(input.profileId, null);
      await logAudit(ctx, {
        action: "reconcile.unlink",
        entityType: "worker_public_profiles",
        entityId: input.profileId,
      });
      return { success: true } as const;
    }),
});
