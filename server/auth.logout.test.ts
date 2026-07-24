import { describe, expect, it, vi } from "vitest";

// 隔離稽核寫入（不碰 DB），同時可斷言 logout 有記稽核
vi.mock("./_core/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import {
  createContext,
  DEV_BYPASS_OFF_COOKIE,
  type TrpcContext,
} from "./_core/context";
import { logAudit } from "./_core/audit";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): {
  ctx: TrpcContext;
  clearedCookies: CookieCall[];
  setCookies: Array<{ name: string; value: string }>;
} {
  const clearedCookies: CookieCall[] = [];
  const setCookies: Array<{ name: string; value: string }> = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    accountType: null,
    workerId: null,
    customerId: null,
    phone: null,
    phoneVerified: 0,
    emailVerified: 1,
    preferredLang: null,
    passwordHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
      cookie: (name: string, value: string) => {
        setCookies.push({ name, value });
      },
    } as unknown as TrpcContext["res"],
  };

  return { ctx, clearedCookies, setCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });

  it("records an audit entry for the logout", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    vi.mocked(logAudit).mockClear();

    await caller.auth.logout();

    expect(logAudit).toHaveBeenCalledTimes(1);
    expect(logAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "auth.logout" })
    );
  });

  it("在 DEV_AUTH_BYPASS 模式下，登出會設 dev_bypass_off 抑制旗標", async () => {
    const prev = process.env.DEV_AUTH_BYPASS;
    process.env.DEV_AUTH_BYPASS = "1";
    try {
      const { ctx, setCookies } = createAuthContext();
      await appRouter.createCaller(ctx).auth.logout();
      expect(
        setCookies.some(
          c => c.name === DEV_BYPASS_OFF_COOKIE && c.value === "1"
        )
      ).toBe(true);
    } finally {
      process.env.DEV_AUTH_BYPASS = prev;
    }
  });

  it("未開 bypass 時，登出不設抑制旗標", async () => {
    const prev = process.env.DEV_AUTH_BYPASS;
    delete process.env.DEV_AUTH_BYPASS;
    try {
      const { ctx, setCookies } = createAuthContext();
      await appRouter.createCaller(ctx).auth.logout();
      expect(setCookies.some(c => c.name === DEV_BYPASS_OFF_COOKIE)).toBe(
        false
      );
    } finally {
      if (prev === undefined) delete process.env.DEV_AUTH_BYPASS;
      else process.env.DEV_AUTH_BYPASS = prev;
    }
  });
});

// createContext 的 bypass 注入行為（登出後不再自動變回 admin）
describe("createContext（本地 bypass 抑制）", () => {
  function fakeOpts(cookieHeader?: string) {
    return {
      req: { protocol: "http", headers: { cookie: cookieHeader } },
      res: { clearCookie: () => {}, cookie: () => {} },
    } as unknown as Parameters<typeof createContext>[0];
  }

  it("bypass 開啟且無抑制 cookie → 注入假 admin", async () => {
    const prev = process.env.DEV_AUTH_BYPASS;
    process.env.DEV_AUTH_BYPASS = "1";
    try {
      const ctx = await createContext(fakeOpts(undefined));
      expect(ctx.user?.role).toBe("admin");
      expect(ctx.user?.openId).toBe("dev-local-admin");
    } finally {
      process.env.DEV_AUTH_BYPASS = prev;
    }
  });

  it("bypass 開啟但帶 dev_bypass_off=1 → 不注入（維持登出）", async () => {
    const prev = process.env.DEV_AUTH_BYPASS;
    process.env.DEV_AUTH_BYPASS = "1";
    try {
      const ctx = await createContext(fakeOpts(`${DEV_BYPASS_OFF_COOKIE}=1`));
      expect(ctx.user).toBeNull();
    } finally {
      process.env.DEV_AUTH_BYPASS = prev;
    }
  });
});
