// ─── 身分與 Session 發放（可插拔認證的抽象接縫）──────────────────────────────
// 任何登入方式（Email/密碼、Manus OAuth、未來的 LINE/WhatsApp）都先產出一個
// 標準化的 IdentityResult，再由 issueSession 統一發 session cookie。
// 新增供應商時只要能產出 IdentityResult 即可，session 發放邏輯不重寫。

import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../cookies";
import { sdk } from "../sdk";

export interface IdentityResult {
  /** 使用者的唯一 openId（session JWT 以此為 subject）。 */
  openId: string;
  email: string | null;
  name: string | null;
  /** 登入方式，如 "email"、"google"、"line"、"whatsapp"。 */
  loginMethod: string;
}

/** 產生本地（Email/密碼）帳號的 openId，前綴 `local_` 以與 Manus/cron openId 區隔。 */
export function newLocalOpenId(): string {
  return `local_${nanoid()}`;
}

/** 為已知身分發 session cookie（與 OAuth 走同一套自簽 JWT + cookie）。 */
export async function issueSession(
  req: Request,
  res: Response,
  identity: Pick<IdentityResult, "openId" | "name">
): Promise<void> {
  const token = await sdk.createSessionToken(identity.openId, {
    name: identity.name || "",
    expiresInMs: ONE_YEAR_MS,
  });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}
