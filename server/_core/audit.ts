// ─── 稽核寫入輔助（WS6）──────────────────────────────────────────────────────
// 提供從 tRPC context 帶出 actor/ip 並寫入 audit_logs 的便捷函式。
// 實際寫入走 db.createAuditLog（fail-safe，失敗不影響主流程）。

import type { Request } from "express";
import { createAuditLog } from "../db";
import type { TrpcContext } from "./context";

/**
 * 取用戶端 IP。Manus 在反向代理後，優先讀 x-forwarded-for 的第一段，
 * 退而求其次用 express 的 req.ip / socket。
 */
export function getClientIp(req: {
  headers?: Request["headers"];
  ip?: string;
  socket?: { remoteAddress?: string };
}): string | undefined {
  const xff = req.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) return xff.split(",")[0].trim();
  if (Array.isArray(xff) && xff.length) return xff[0];
  return req.ip ?? req.socket?.remoteAddress ?? undefined;
}

export interface AuditInput {
  /** 事件動作，如 "auth.login"、"auth.logout"、"user.role_change"。 */
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  /** 額外資訊；會被 JSON.stringify 存入 meta 欄位。 */
  meta?: Record<string, unknown> | null;
}

/**
 * 從 ctx 帶出 actorUserId 與 ip，寫一筆稽核。fail-safe（底層 createAuditLog 已包 try/catch）。
 * dev 繞過登入的假帳號 id 為 0，視為無真實 actor（記為 null）。
 */
export async function logAudit(
  ctx: Pick<TrpcContext, "user" | "req">,
  input: AuditInput
): Promise<void> {
  const actorUserId = ctx.user?.id && ctx.user.id > 0 ? ctx.user.id : null;
  await createAuditLog({
    actorUserId,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    meta: input.meta ? JSON.stringify(input.meta) : null,
    ip: getClientIp(ctx.req) ?? null,
  });
}
