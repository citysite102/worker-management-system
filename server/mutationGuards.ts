/**
 * Mutation 共用守衛與稽核骨架。
 *
 * 收攏 routers.ts 中重複的兩個樣式：
 *   1. loadOwnedOrThrow —— 載入某筆、比對擁有者、否則 NOT_FOUND（找不到與非本人
 *      刻意都回同一個 NOT_FOUND，不對非擁有者洩漏存在性）。擁有權檢查集中一處、測一次。
 *   2. recordModeration —— staff 審核動作一律「同進同出」寫兩份稽核：
 *      moderation_events（單數 entityType + staffId + reason）與 audit log
 *      （複數表名 entityType + meta）。用一個函式呼叫，避免只寫一半。
 */
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";
import type { InsertModerationEvent } from "../drizzle/schema";
import { insertModerationEvent } from "./db";
import { logAudit } from "./_core/audit";

/**
 * 載入一筆並確認屬於 ownerId；找不到或非本人一律丟 NOT_FOUND（不洩漏存在性）。
 * 回傳該筆（已窄化為非 null），供後續使用。
 */
export async function loadOwnedOrThrow<T>(
  fetchById: (id: number) => Promise<T | null | undefined>,
  id: number,
  ownerId: number,
  ownerField: keyof T,
  notFoundMessage: string
): Promise<T> {
  const row = await fetchById(id);
  if (!row || row[ownerField] !== ownerId) {
    throw new TRPCError({ code: "NOT_FOUND", message: notFoundMessage });
  }
  return row;
}

/**
 * staff 審核動作的雙稽核：寫 moderation_events 與 audit log。
 * staffId 一律取自 ctx.user；兩筆共用同一 entityId。
 */
export async function recordModeration(
  ctx: Pick<TrpcContext, "user" | "req">,
  moderation: {
    /** moderation_events 的 entityType（單數，如 "job_posting"）。 */
    entityType: InsertModerationEvent["entityType"];
    entityId: number;
    /** 動作（如 "approve" / "reject"）。 */
    action: InsertModerationEvent["action"];
    reason?: string | null;
  },
  audit: {
    /** audit log 的 action（點式，如 "moderation.posting.approve"）。 */
    action: string;
    /** audit log 的 entityType（複數表名，如 "job_postings"）。 */
    entityType: string;
    meta?: Record<string, unknown>;
  }
): Promise<void> {
  await insertModerationEvent({
    entityType: moderation.entityType,
    entityId: moderation.entityId,
    action: moderation.action,
    reason: moderation.reason ?? null,
    staffId: ctx.user?.id ?? null,
  });
  await logAudit(ctx, {
    action: audit.action,
    entityType: audit.entityType,
    entityId: moderation.entityId,
    meta: audit.meta,
  });
}
