import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

// ─── Mock db（只放行評分 procedure 會用到的函式）──────────────────────────────
// vi.mock 提升到檔首，工廠內不能參照外層變數，故用 vi.hoisted。
const dbMock = vi.hoisted(() => ({
  getEmploymentById: vi.fn(),
  getCaseById: vi.fn(),
  getRatingByEmployment: vi.fn(),
  createRating: vi.fn().mockResolvedValue(1),
  recomputeWorkerRating: vi.fn().mockResolvedValue(undefined),
  getRatingsByWorker: vi.fn().mockResolvedValue([]),
}));
vi.mock("./db", () => dbMock);

vi.mock("./_core/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  getClientIp: () => "127.0.0.1",
}));

function makeUser(overrides: Partial<User>): User {
  const now = new Date("2026-01-01T00:00:00Z");
  return {
    id: 1,
    openId: "u1",
    name: "測試",
    email: "u1@test.local",
    loginMethod: "email",
    role: "user",
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
    ...overrides,
  };
}

function caller(user: User | null) {
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

const anon = () => caller(null);
// 該案雇主：customerId 與 case.customerId 相符
const ownerEmployer = () =>
  caller(makeUser({ id: 9, accountType: "employer", customerId: 55 }));
// 他人雇主：customerId 不符
const otherEmployer = () =>
  caller(makeUser({ id: 8, accountType: "employer", customerId: 999 }));
const staff = () =>
  caller(makeUser({ id: 2, role: "staff", accountType: "staff" }));

// 一筆「已完成」的聘僱（terminated），案件屬 customerId 55、workers.id 77
const FINISHED_EMP = {
  id: 100,
  caseId: 40,
  workerId: 77,
  status: "terminated" as const,
  contractEnd: "2026-05-01",
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.getCaseById.mockResolvedValue({ id: 40, customerId: 55 });
  dbMock.getRatingByEmployment.mockResolvedValue(undefined);
});

describe("ratings.create — 只限已完成工作 + 授權 + 防重複", () => {
  it("匿名不可評分（UNAUTHORIZED）", async () => {
    await expect(
      anon().ratings.create({ employmentId: 100, score: 5 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("找不到聘僱 → NOT_FOUND", async () => {
    dbMock.getEmploymentById.mockResolvedValue(undefined);
    await expect(
      staff().ratings.create({ employmentId: 100, score: 5 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("聘僱仍在職（active）→ 擋下，訊息『只能評價已完成的工作』", async () => {
    dbMock.getEmploymentById.mockResolvedValue({
      ...FINISHED_EMP,
      status: "active",
      contractEnd: null,
    });
    await expect(
      staff().ratings.create({ employmentId: 100, score: 5 })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "只能評價已完成的工作",
    });
    expect(dbMock.createRating).not.toHaveBeenCalled();
  });

  it("active 但合約結束日已過 → 視為完成，可評", async () => {
    dbMock.getEmploymentById.mockResolvedValue({
      ...FINISHED_EMP,
      status: "active",
      contractEnd: "2020-01-01",
    });
    await staff().ratings.create({ employmentId: 100, score: 4 });
    expect(dbMock.createRating).toHaveBeenCalledWith(
      expect.objectContaining({ employmentId: 100, workerId: 77, score: 4 })
    );
  });

  it("非該案雇主 → FORBIDDEN『只有該工作的雇主可評價』", async () => {
    dbMock.getEmploymentById.mockResolvedValue(FINISHED_EMP);
    await expect(
      otherEmployer().ratings.create({ employmentId: 100, score: 5 })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "只有該工作的雇主可評價",
    });
    expect(dbMock.createRating).not.toHaveBeenCalled();
  });

  it("該案雇主 → 成功建立並重算聚合", async () => {
    dbMock.getEmploymentById.mockResolvedValue(FINISHED_EMP);
    const caller = ownerEmployer();
    const r = await caller.ratings.create({
      employmentId: 100,
      score: 5,
      comment: "認真負責",
    });
    expect(r).toEqual({ success: true });
    expect(dbMock.createRating).toHaveBeenCalledWith(
      expect.objectContaining({
        employmentId: 100,
        workerId: 77,
        raterUserId: 9,
        score: 5,
        comment: "認真負責",
      })
    );
    expect(dbMock.recomputeWorkerRating).toHaveBeenCalledWith(77);
  });

  it("staff 可代任何聘僱評分", async () => {
    dbMock.getEmploymentById.mockResolvedValue(FINISHED_EMP);
    await staff().ratings.create({ employmentId: 100, score: 3 });
    expect(dbMock.createRating).toHaveBeenCalledWith(
      expect.objectContaining({ raterUserId: 2, score: 3 })
    );
  });

  it("同一聘僱重複評分 → CONFLICT", async () => {
    dbMock.getEmploymentById.mockResolvedValue(FINISHED_EMP);
    dbMock.getRatingByEmployment.mockResolvedValue({
      id: 1,
      employmentId: 100,
    });
    await expect(
      staff().ratings.create({ employmentId: 100, score: 5 })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(dbMock.createRating).not.toHaveBeenCalled();
  });

  it("score 超出 1..5 → 輸入驗證擋下（BAD_REQUEST）", async () => {
    dbMock.getEmploymentById.mockResolvedValue(FINISHED_EMP);
    await expect(
      staff().ratings.create({ employmentId: 100, score: 6 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      staff().ratings.create({ employmentId: 100, score: 0 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("ratings.forWorker — 去識別清單（登入後可讀個別評論）", () => {
  it("匿名不可讀評論清單（UNAUTHORIZED）", async () => {
    await expect(
      anon().ratings.forWorker({ workerId: 77 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("登入者回傳分數/評論/日期，不含評分者身分", async () => {
    dbMock.getRatingsByWorker.mockResolvedValue([
      {
        id: 5,
        score: 5,
        comment: "很好",
        createdAt: new Date("2026-06-01T00:00:00Z"),
      },
    ]);
    const caller = staff();
    const rows = await caller.ratings.forWorker({ workerId: 77 });
    expect(rows).toEqual([
      {
        id: 5,
        score: 5,
        comment: "很好",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    // 確認沒有洩漏 raterUserId 等欄位
    expect(Object.keys(rows[0])).toEqual([
      "id",
      "score",
      "comment",
      "createdAt",
    ]);
  });
});
