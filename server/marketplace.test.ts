import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

// ─── Mock db（只放行銷平台 procedure 會用到的函式）────────────────────────────
// vi.mock 會被提升到檔首，工廠內不能參照外層變數，故用 vi.hoisted 建立 mock。
const dbMock = vi.hoisted(() => ({
  // publicJobs
  listApprovedJobPostings: vi.fn().mockResolvedValue([]),
  listPublicOpenDemands: vi.fn().mockResolvedValue([]),
  getJobPostingById: vi.fn().mockResolvedValue(undefined),
  getDemandById: vi.fn().mockResolvedValue(undefined),
  getCaseById: vi.fn().mockResolvedValue(undefined),
  // employer
  getJobPostingsByEmployer: vi.fn().mockResolvedValue([]),
  createJobPosting: vi.fn().mockResolvedValue(701),
  updateJobPosting: vi.fn().mockResolvedValue({}),
  insertModerationEvent: vi.fn().mockResolvedValue(undefined),
  // moderation
  getPendingJobPostings: vi.fn().mockResolvedValue([]),
  claimJobPostingForApproval: vi.fn().mockResolvedValue(true),
  getUserById: vi
    .fn()
    .mockResolvedValue({ id: 9, name: "王雇主", email: "e@x.co" }),
  createCustomer: vi.fn().mockResolvedValue(301),
  createCase: vi.fn().mockResolvedValue(401),
  createQualification: vi.fn().mockResolvedValue(501),
  createDemand: vi.fn().mockResolvedValue(601),
  // hardening 用
  getAllWorkers: vi.fn().mockResolvedValue([]),
}));
vi.mock("./db", () => dbMock);

// 稽核：不落 DB
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
const worker = () => caller(makeUser({ id: 10, accountType: "worker" }));
const employer = () =>
  caller(makeUser({ id: 9, accountType: "employer", customerId: null }));
const staff = () =>
  caller(makeUser({ id: 2, role: "staff", accountType: "staff" }));
const admin = () => caller(makeUser({ id: 1, role: "admin" }));

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.getUserById.mockResolvedValue({
    id: 9,
    name: "王雇主",
    email: "e@x.co",
  });
});

describe("找工作（publicJobs，需登入）", () => {
  it("未登入呼叫 list 會被擋（UNAUTHORIZED）", async () => {
    await expect(anon().publicJobs.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("登入者（移工）可瀏覽，回傳陣列", async () => {
    const res = await worker().publicJobs.list();
    expect(Array.isArray(res)).toBe(true);
  });

  it("統一呈現公開需求單 + 既有內部需求單，並套三桶職類", async () => {
    dbMock.listApprovedJobPostings.mockResolvedValueOnce([
      {
        id: 1,
        jobType: "caregiver",
        city: "臺北市",
        district: null,
        headcount: 1,
        employmentType: "live_in",
        publicDescription: "顧阿嬤",
        salaryMin: 28000,
        salaryMax: null,
        publishedAt: new Date("2026-07-20T00:00:00Z"),
        createdAt: new Date("2026-07-20T00:00:00Z"),
      },
    ]);
    dbMock.listPublicOpenDemands.mockResolvedValueOnce([
      {
        id: 5,
        caseId: 401,
        qualType: "manufacturing",
        neededCount: 3,
        status: "open",
        publicCity: "桃園市",
        createdAt: new Date("2026-07-21T00:00:00Z"),
      },
    ]);
    const res = await worker().publicJobs.list();
    expect(res).toHaveLength(2);
    // 既有內部需求（demand）較新 → 排前面
    expect(res[0]).toMatchObject({
      source: "demand",
      category: "other",
      city: "桃園市",
    });
    expect(res[1]).toMatchObject({ source: "posting", category: "caregiver" });
  });

  it("category 篩選只留對應桶", async () => {
    dbMock.listApprovedJobPostings.mockResolvedValueOnce([
      {
        id: 1,
        jobType: "caregiver",
        city: "臺北市",
        district: null,
        headcount: 1,
        employmentType: "live_in",
        publicDescription: null,
        salaryMin: null,
        salaryMax: null,
        publishedAt: null,
        createdAt: new Date(),
      },
    ]);
    dbMock.listPublicOpenDemands.mockResolvedValueOnce([
      {
        id: 5,
        caseId: 401,
        qualType: "manufacturing",
        neededCount: 3,
        status: "open",
        publicCity: "桃園市",
        createdAt: new Date(),
      },
    ]);
    const res = await worker().publicJobs.list({ category: "caregiver" });
    expect(res).toHaveLength(1);
    expect(res[0].source).toBe("posting");
  });

  it("get：非 approved 的需求單一律 NOT_FOUND", async () => {
    dbMock.getJobPostingById.mockResolvedValueOnce({
      id: 1,
      status: "pending_review",
    });
    await expect(
      worker().publicJobs.get({ source: "posting", id: 1 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("expressInterest：登入者可送出意向", async () => {
    const res = await worker().publicJobs.expressInterest({
      source: "posting",
      id: 1,
    });
    expect(res.success).toBe(true);
  });
});

describe("雇主專區（employer）權限", () => {
  it("未登入 → UNAUTHORIZED", async () => {
    await expect(anon().employer.myPostings()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it("移工帳號 → FORBIDDEN", async () => {
    await expect(worker().employer.myPostings()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("雇主帳號 → 可用", async () => {
    const res = await employer().employer.myPostings();
    expect(Array.isArray(res)).toBe(true);
  });
  it("建立需求單（submit）→ 寫入 pending_review 並記一筆送審事件", async () => {
    const res = await employer().employer.createPosting({
      jobType: "caregiver",
      city: "臺北市",
      headcount: 1,
      employmentType: "live_in",
      submit: true,
    });
    expect(res).toMatchObject({ success: true, status: "pending_review" });
    expect(dbMock.createJobPosting).toHaveBeenCalledWith(
      expect.objectContaining({ employerUserId: 9, status: "pending_review" })
    );
    expect(dbMock.insertModerationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "submit", entityType: "job_posting" })
    );
  });
});

describe("審核（moderation）權限與轉 case", () => {
  it("未登入 → UNAUTHORIZED；移工 → FORBIDDEN；staff → 可用", async () => {
    await expect(anon().moderation.pendingPostings()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(worker().moderation.pendingPostings()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const res = await staff().moderation.pendingPostings();
    expect(Array.isArray(res)).toBe(true);
  });

  it("approve：自動建立 case + 資格 + 需求，並回連 caseId", async () => {
    dbMock.getJobPostingById.mockResolvedValueOnce({
      id: 700,
      status: "pending_review",
      employerUserId: 9,
      customerId: null,
      jobType: "caregiver",
      city: "臺中市",
      headcount: 2,
    });
    const res = await staff().moderation.approvePosting({
      id: 700,
      managerId: 3,
    });
    expect(res).toMatchObject({ success: true, caseId: 401 });
    // 無勾稽雇主 → 自動建 customer
    expect(dbMock.createCustomer).toHaveBeenCalledTimes(1);
    expect(dbMock.createCase).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 301,
        publicCity: "臺中市",
        managerId: 3,
      })
    );
    expect(dbMock.createQualification).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 401,
        qualType: "caregiver",
        category: "labor_out",
      })
    );
    // 自動 demand 於公開站隱藏，避免與 posting 卡片重複（Code Review #1）
    expect(dbMock.createDemand).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 401,
        neededCount: 2,
        status: "open",
        publicHidden: 1,
      })
    );
    // claim 已把狀態設 approved，第 4 步只回填 caseId
    expect(dbMock.updateJobPosting).toHaveBeenCalledWith(
      700,
      expect.objectContaining({ caseId: 401 })
    );
  });

  it("approve：非待審狀態 → BAD_REQUEST", async () => {
    dbMock.getJobPostingById.mockResolvedValueOnce({
      id: 700,
      status: "approved",
    });
    await expect(
      staff().moderation.approvePosting({ id: 700, managerId: 3 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("approve：併發搶佔失敗（claimed=false）→ BAD_REQUEST，不建立 case", async () => {
    dbMock.getJobPostingById.mockResolvedValueOnce({
      id: 700,
      status: "pending_review",
      employerUserId: 9,
      customerId: null,
      jobType: "caregiver",
      city: "臺中市",
      headcount: 1,
    });
    dbMock.claimJobPostingForApproval.mockResolvedValueOnce(false);
    await expect(
      staff().moderation.approvePosting({ id: 700, managerId: 3 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMock.createCase).not.toHaveBeenCalled();
  });

  it("reject：寫入 rejected + 理由", async () => {
    dbMock.getJobPostingById.mockResolvedValueOnce({
      id: 700,
      status: "pending_review",
    });
    await staff().moderation.rejectPosting({
      id: 700,
      reasonCode: "incomplete",
      note: "缺薪資",
    });
    expect(dbMock.updateJobPosting).toHaveBeenCalledWith(
      700,
      expect.objectContaining({ status: "rejected" })
    );
  });
});

describe("WS3 硬化：內部 procedure 需 staff/admin", () => {
  it("未登入呼叫 workers.list → UNAUTHORIZED", async () => {
    await expect(anon().workers.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it("移工帳號呼叫 workers.list → FORBIDDEN", async () => {
    await expect(worker().workers.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("admin 可呼叫 workers.list", async () => {
    const res = await admin().workers.list();
    expect(Array.isArray(res)).toBe(true);
  });
});
