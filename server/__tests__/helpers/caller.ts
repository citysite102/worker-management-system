/**
 * 建立 tRPC caller 的共用工具，單元測試與整合測試都可用。
 *
 * 直接呼叫 `appRouter.createCaller()`，不經過 HTTP，因此測的是 procedure
 * 本身的邏輯與輸入驗證，速度接近純函式測試。
 */
import { vi } from "vitest";
import type { User } from "../../../drizzle/schema";
import { appRouter } from "../../routers";
import type { TrpcContext } from "../../_core/context";

const ADMIN_USER: User = {
  id: 1,
  openId: "test-admin",
  name: "測試管理員",
  email: "admin@test.local",
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
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  lastSignedIn: new Date("2026-01-01T00:00:00Z"),
};

export function createTestContext(user: User | null = ADMIN_USER): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

/** 已登入（admin）的 caller。 */
export function createCaller(user: User | null = ADMIN_USER) {
  return appRouter.createCaller(createTestContext(user));
}

/** 未登入的 caller，用來驗證權限保護。 */
export function createAnonymousCaller() {
  return appRouter.createCaller(createTestContext(null));
}

export { ADMIN_USER };
