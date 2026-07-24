import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

/** 本地開發繞過登入用的抑制旗標：登出後設此 cookie，讓 context 不再注入假 admin。 */
export const DEV_BYPASS_OFF_COOKIE = "dev_bypass_off";

function hasDevBypassOff(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) return false;
  try {
    return parseCookieHeader(cookieHeader)[DEV_BYPASS_OFF_COOKIE] === "1";
  } catch {
    return false;
  }
}

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // ─── 本地開發繞過登入 ──────────────────────────────────────────────
  // 僅在開發模式且明確開啟 DEV_AUTH_BYPASS 時注入假 admin，方便在本地
  // 沒有 Manus OAuth 設定的情況下操作畫面。production 不會生效。
  // 例外：若使用者在 bypass 模式下按了「登出」，logout 會設一枚 dev_bypass_off
  // cookie；此時不再注入假 admin，讓登出真的看得到效果（登入或清 cookie 後恢復）。
  if (
    !user &&
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_AUTH_BYPASS === "1" &&
    !hasDevBypassOff(opts.req.headers.cookie)
  ) {
    const now = new Date();
    user = {
      id: 0,
      openId: "dev-local-admin",
      name: "本地開發者",
      email: "dev@localhost",
      loginMethod: "dev",
      role: "admin",
      accountType: null,
      workerId: null,
      customerId: null,
      phone: null,
      phoneVerified: 0,
      emailVerified: 1,
      preferredLang: null,
      passwordHash: null,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    } satisfies User;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
