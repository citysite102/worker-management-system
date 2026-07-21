import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

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
  if (
    !user &&
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_AUTH_BYPASS === "1"
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
