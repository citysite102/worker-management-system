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
  // match requests (P3)
  createMatchRequest: vi.fn().mockResolvedValue(801),
  getOpenMatchRequest: vi.fn().mockResolvedValue(undefined),
  getAllMatchRequests: vi.fn().mockResolvedValue([]),
  getMatchRequestById: vi.fn().mockResolvedValue(undefined),
  updateMatchRequest: vi.fn().mockResolvedValue({}),
  getMatchRequestsByInitiator: vi.fn().mockResolvedValue([]),
  // worker profiles / find-workers (P2)
  getProfileByUserId: vi.fn().mockResolvedValue(undefined),
  getProfileById: vi.fn().mockResolvedValue(undefined),
  createProfile: vi.fn().mockResolvedValue(901),
  updateProfile: vi.fn().mockResolvedValue({}),
  getPendingProfiles: vi.fn().mockResolvedValue([]),
  listPublicProfiles: vi.fn().mockResolvedValue([]),
  getExperiencesByUserId: vi.fn().mockResolvedValue([]),
  getApprovedExperiencesByUserId: vi.fn().mockResolvedValue([]),
  getExperienceById: vi.fn().mockResolvedValue(undefined),
  createExperience: vi.fn().mockResolvedValue(950),
  updateExperience: vi.fn().mockResolvedValue({}),
  deleteExperience: vi.fn().mockResolvedValue({}),
  getPendingExperiences: vi.fn().mockResolvedValue([]),
  getEmploymentsByWorker: vi.fn().mockResolvedValue([]),
  countApprovedPostingsByEmployer: vi.fn().mockResolvedValue(1),
  getAllProfiles: vi.fn().mockResolvedValue([]),
  searchWorkersForReconcile: vi.fn().mockResolvedValue([]),
  setProfileWorkerLink: vi.fn().mockResolvedValue({}),
  getWorkerById: vi.fn().mockResolvedValue(undefined),
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

describe("找工作（publicJobs，開放匿名瀏覽）", () => {
  it("未登入即可呼叫 list，回傳陣列", async () => {
    const res = await anon().publicJobs.list();
    expect(Array.isArray(res)).toBe(true);
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

  it("expressInterest：登入者送出意向會建立 match_request", async () => {
    dbMock.getJobPostingById.mockResolvedValueOnce({
      id: 1,
      status: "approved",
      jobType: "caregiver",
      city: "臺北市",
    });
    const res = await worker().publicJobs.expressInterest({
      source: "posting",
      id: 1,
    });
    expect(res).toMatchObject({ success: true, alreadySent: false });
    expect(dbMock.createMatchRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        initiatorUserId: 10,
        initiatorType: "worker",
        targetType: "job_posting",
        targetId: 1,
        status: "new",
      })
    );
  });

  it("expressInterest：已有進行中的意向 → 不重複建立", async () => {
    dbMock.getJobPostingById.mockResolvedValueOnce({
      id: 1,
      status: "approved",
      jobType: "caregiver",
      city: "臺北市",
    });
    dbMock.getOpenMatchRequest.mockResolvedValueOnce({
      id: 999,
      status: "new",
    });
    const res = await worker().publicJobs.expressInterest({
      source: "posting",
      id: 1,
    });
    expect(res).toMatchObject({ success: true, alreadySent: true });
    expect(dbMock.createMatchRequest).not.toHaveBeenCalled();
  });

  it("expressInterest：標的不存在 → NOT_FOUND", async () => {
    dbMock.getJobPostingById.mockResolvedValueOnce(undefined);
    await expect(
      worker().publicJobs.expressInterest({ source: "posting", id: 1 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("expressInterest：非公開需求單（draft/rejected）→ NOT_FOUND，不建立", async () => {
    dbMock.getJobPostingById.mockResolvedValueOnce({ id: 1, status: "draft" });
    await expect(
      worker().publicJobs.expressInterest({ source: "posting", id: 1 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(dbMock.createMatchRequest).not.toHaveBeenCalled();
  });

  it("expressInterest：已隱藏的既有需求 → NOT_FOUND", async () => {
    dbMock.getDemandById.mockResolvedValueOnce({
      id: 3,
      status: "open",
      publicHidden: 1,
      caseId: 401,
    });
    await expect(
      worker().publicJobs.expressInterest({ source: "demand", id: 3 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // ─── 信箱驗證 gating（requireEmailVerified）──────────────────────────────────
  it("expressInterest：未驗證信箱的 Email 帳號 → FORBIDDEN（在觸及標的查詢前擋下）", async () => {
    const unverified = caller(
      makeUser({ id: 10, accountType: "worker", emailVerified: 0 })
    );
    await expect(
      unverified.publicJobs.expressInterest({ source: "posting", id: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // 被中介層擋下，未進到標的查詢與建立
    expect(dbMock.getJobPostingById).not.toHaveBeenCalled();
    expect(dbMock.createMatchRequest).not.toHaveBeenCalled();
  });

  it("expressInterest：WhatsApp 手機帳號（loginMethod!=email）不受 gating 影響", async () => {
    dbMock.getJobPostingById.mockResolvedValueOnce(undefined);
    const wa = caller(
      makeUser({
        id: 11,
        accountType: "worker",
        loginMethod: "whatsapp",
        emailVerified: 0,
      })
    );
    // 通過 gating → 因標的不存在改為 NOT_FOUND（證明未被 FORBIDDEN 擋）
    await expect(
      wa.publicJobs.expressInterest({ source: "posting", id: 1 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("myInterests：登入者可查自己的意向", async () => {
    const res = await worker().publicJobs.myInterests();
    expect(Array.isArray(res)).toBe(true);
  });
});

describe("開放諮詢入口（submitInquiry，§8 lead-pipeline）", () => {
  it("submitInquiry：未登入 → UNAUTHORIZED，不建立", async () => {
    await expect(
      anon().publicJobs.submitInquiry({ inquiryCategory: "caregiver" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(dbMock.createMatchRequest).not.toHaveBeenCalled();
  });

  it("submitInquiry：登入者送出 → 建立 general_inquiry（targetId=0，帶意向欄位）", async () => {
    const res = await employer().publicJobs.submitInquiry({
      inquiryCategory: "caregiver",
      inquiryCity: "臺北市",
      note: "想請一位住家看護，想了解流程",
      preferredChannel: "line",
      preferredTime: "evening",
    });
    expect(res).toMatchObject({ success: true, alreadySent: false });
    expect(dbMock.createMatchRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        initiatorType: "employer",
        targetType: "general_inquiry",
        targetId: 0,
        status: "new",
        inquiryCategory: "caregiver",
        inquiryCity: "臺北市",
        preferredChannel: "line",
        preferredTime: "evening",
      })
    );
  });

  it("submitInquiry：已有進行中的諮詢 → 不重複建立（alreadySent）", async () => {
    dbMock.getOpenMatchRequest.mockResolvedValueOnce({
      id: 888,
      status: "new",
    });
    const res = await worker().publicJobs.submitInquiry({
      inquiryCategory: "unsure",
    });
    expect(res).toMatchObject({ success: true, alreadySent: true });
    expect(dbMock.createMatchRequest).not.toHaveBeenCalled();
  });

  it("submitInquiry：去重以 general_inquiry / targetId=0 查詢", async () => {
    await worker().publicJobs.submitInquiry({ inquiryCategory: "other" });
    expect(dbMock.getOpenMatchRequest).toHaveBeenCalledWith(
      10,
      "general_inquiry",
      0
    );
  });

  it("myInterests：general_inquiry 列的 city/category 取自意向欄位、jobType=null", async () => {
    dbMock.getMatchRequestsByInitiator.mockResolvedValueOnce([
      {
        id: 42,
        status: "new",
        note: "test",
        createdAt: new Date(),
        targetType: "general_inquiry",
        targetId: 0,
        inquiryCategory: "domestic_helper",
        inquiryCity: "臺中市",
      },
    ]);
    const rows = await worker().publicJobs.myInterests();
    expect(rows[0]).toMatchObject({
      targetType: "general_inquiry",
      jobType: null,
      city: "臺中市",
      category: "domestic_helper",
    });
    // general_inquiry 不應觸發標的查詢（無標的）
    expect(dbMock.getJobPostingById).not.toHaveBeenCalled();
  });

  it("myInterests：inquiryCategory=unsure → category 回 null（不對應公開三桶）", async () => {
    dbMock.getMatchRequestsByInitiator.mockResolvedValueOnce([
      {
        id: 43,
        status: "new",
        note: null,
        createdAt: new Date(),
        targetType: "general_inquiry",
        targetId: 0,
        inquiryCategory: "unsure",
        inquiryCity: null,
      },
    ]);
    const rows = await worker().publicJobs.myInterests();
    expect(rows[0]).toMatchObject({
      targetType: "general_inquiry",
      category: null,
      city: null,
    });
  });
});

describe("媒合意向佇列（matchRequests，客服）權限與操作", () => {
  it("queue：未登入 → UNAUTHORIZED；移工 → FORBIDDEN；staff → 可用", async () => {
    await expect(anon().matchRequests.queue()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(worker().matchRequests.queue()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const res = await staff().matchRequests.queue();
    expect(Array.isArray(res)).toBe(true);
  });

  it("updateStatus：staff 可更新狀態", async () => {
    dbMock.getMatchRequestById.mockResolvedValueOnce({
      id: 5,
      status: "new",
      staffNote: null,
      closeReason: null,
    });
    await staff().matchRequests.updateStatus({ id: 5, status: "introduced" });
    expect(dbMock.updateMatchRequest).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ status: "introduced" })
    );
  });

  it("assign：未指定 staffId 則指派給自己，並把 new → staff_handling", async () => {
    dbMock.getMatchRequestById.mockResolvedValueOnce({ id: 5, status: "new" });
    await staff().matchRequests.assign({ id: 5 });
    expect(dbMock.updateMatchRequest).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ assignedStaffId: 2, status: "staff_handling" })
    );
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

describe("移工履歷（worker，P2）", () => {
  it("未登入 → UNAUTHORIZED；雇主 → FORBIDDEN；移工 → 可用", async () => {
    await expect(anon().worker.myProfile()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(employer().worker.myProfile()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await worker().worker.myProfile()).toBeNull();
  });

  it("upsertProfile 初次建立並送審 → createProfile + pending + 送審事件", async () => {
    const res = await worker().worker.upsertProfile({
      alias: "小明",
      nationality: "印尼",
      jobTypes: ["caregiver", "intermediate"],
      skills: ["翻身", "備餐"],
      languages: ["中文", "印尼文"],
      submit: true,
    });
    expect(res).toMatchObject({ success: true, submitted: true });
    expect(dbMock.createProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 10,
        moderationStatus: "pending",
        publishStatus: "published",
      })
    );
    expect(dbMock.insertModerationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "worker_profile",
        action: "submit",
      })
    );
  });

  it("addExperience：移工可新增自填經歷", async () => {
    const res = await worker().worker.addExperience({
      employerType: "family_care",
      role: "看護",
    });
    expect(res.success).toBe(true);
    expect(dbMock.createExperience).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 10, role: "看護" })
    );
  });
});

describe("找移工（findWorkers，P2）權限、gating 與匿名", () => {
  it("未登入即可瀏覽 list（開放匿名，回陣列）", async () => {
    dbMock.listPublicProfiles.mockResolvedValueOnce([]);
    const res = await anon().findWorkers.list();
    expect(Array.isArray(res)).toBe(true);
  });

  it("移工帳號也可瀏覽 list（瀏覽不限身分）", async () => {
    dbMock.listPublicProfiles.mockResolvedValueOnce([]);
    const res = await worker().findWorkers.list();
    expect(Array.isArray(res)).toBe(true);
  });

  it("瀏覽 list 不再需要通過的需求單（去識別，回匿名視圖）", async () => {
    dbMock.listPublicProfiles.mockResolvedValueOnce([
      {
        id: 7,
        userId: 10,
        workerId: 55,
        alias: "小明",
        headline: "細心可靠",
        nationality: "印尼",
        yearOfBirth: 1995,
        jobType: "caregiver",
        skills: JSON.stringify(["翻身"]),
        languages: JSON.stringify(["中文"]),
        availability: "即刻",
        selfIntro: "hi",
      },
    ]);
    const res = await employer().findWorkers.list();
    expect(res).toHaveLength(1);
    const card = res[0] as Record<string, unknown>;
    expect(card).toMatchObject({ id: 7, alias: "小明", category: "caregiver" });
    expect(card.ageRange).toBeTruthy();
    expect(card.userId).toBeUndefined();
    expect(card.workerId).toBeUndefined();
    // 自我介紹改為受保護欄位 → 不在公開卡片視圖
    expect(card.selfIntro).toBeUndefined();
    // 公開層只給「有無照片」布林，不給實際照片；評分未達門檻不外露
    expect(card.hasPhoto).toBe(false);
    expect(card.rating).toBeNull();
  });

  it("期望職類多選：view 回傳 jobTypes 陣列；舊單值列回退為 [jobType]", async () => {
    dbMock.listPublicProfiles.mockResolvedValueOnce([
      {
        id: 1,
        alias: "多選",
        jobTypes: JSON.stringify(["caregiver", "intermediate"]),
      },
      { id: 2, alias: "舊列", jobType: "manufacturing" }, // 無 jobTypes
    ]);
    const res = (await anon().findWorkers.list()) as Array<
      Record<string, unknown>
    >;
    expect(res[0].jobTypes).toEqual(["caregiver", "intermediate"]);
    expect(res[0].category).toBe("caregiver"); // 主要職類（首項）→ 三桶
    expect(res[1].jobTypes).toEqual(["manufacturing"]); // 回退
    expect(res[1].category).toBe("other");
  });

  it("評分：達門檻（≥5 則）才外露平均分與則數，未達則 rating=null", async () => {
    dbMock.listPublicProfiles.mockResolvedValueOnce([
      {
        id: 1,
        alias: "A",
        jobType: "caregiver",
        ratingAvg: 47,
        ratingCount: 8,
      },
      {
        id: 2,
        alias: "B",
        jobType: "caregiver",
        ratingAvg: 50,
        ratingCount: 3,
      },
    ]);
    const res = (await anon().findWorkers.list()) as Array<
      Record<string, unknown>
    >;
    expect(res[0].rating).toEqual({ avg: 4.7, count: 8 });
    expect(res[1].rating).toBeNull(); // 3 < 5 → 不顯示
  });

  it("get：未公開/未通過的履歷 → NOT_FOUND", async () => {
    dbMock.countApprovedPostingsByEmployer.mockResolvedValueOnce(1);
    dbMock.getProfileById.mockResolvedValueOnce({
      id: 7,
      publishStatus: "draft",
      moderationStatus: "pending",
    });
    await expect(employer().findWorkers.get({ id: 7 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("get（未登入）：受保護欄位不下傳——gated=true、selfIntro=null、經歷/紀錄為空", async () => {
    dbMock.getProfileById.mockResolvedValueOnce({
      id: 7,
      userId: 10,
      workerId: 55,
      alias: "小明",
      jobType: "caregiver",
      selfIntro: "祕密自我介紹",
      photoKey: "photos/7.jpg",
      publishStatus: "published",
      moderationStatus: "approved",
    });
    const res = (await anon().findWorkers.get({ id: 7 })) as Record<
      string,
      unknown
    >;
    expect(res.gated).toBe(true);
    expect(res.selfIntro).toBeNull();
    expect(res.photoUrl).toBeNull();
    expect(res.experiences).toEqual([]);
    expect(res.platformRecords).toEqual([]);
    // 未登入時完全不查經歷/平台紀錄（避免任何洩漏）
    expect(dbMock.getApprovedExperiencesByUserId).not.toHaveBeenCalled();
    expect(dbMock.getEmploymentsByWorker).not.toHaveBeenCalled();
  });

  it("get（已登入）：gated=false，附上自我介紹、經歷與真實照片 URL", async () => {
    dbMock.getProfileById.mockResolvedValueOnce({
      id: 7,
      userId: 10,
      workerId: 55,
      alias: "小明",
      jobType: "caregiver",
      selfIntro: "完整自我介紹",
      photoKey: "photos/7.jpg",
      publishStatus: "published",
      moderationStatus: "approved",
    });
    dbMock.getApprovedExperiencesByUserId.mockResolvedValueOnce([
      {
        id: 1,
        employerType: "family_care",
        role: "看護",
        startDate: "2020-01",
        endDate: null,
        description: "照顧長輩",
      },
    ]);
    const res = (await worker().findWorkers.get({ id: 7 })) as Record<
      string,
      unknown
    >;
    expect(res.gated).toBe(false);
    expect(res.selfIntro).toBe("完整自我介紹");
    expect(res.photoUrl).toBe("/manus-storage/photos/7.jpg");
    expect(res.experiences).toHaveLength(1);
  });

  it("expressInterest（雇主對移工）建立 match_request targetType=worker", async () => {
    dbMock.getProfileById.mockResolvedValueOnce({
      id: 7,
      publishStatus: "published",
      moderationStatus: "approved",
    });
    const res = await employer().findWorkers.expressInterest({ id: 7 });
    expect(res).toMatchObject({ success: true, alreadySent: false });
    expect(dbMock.createMatchRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        initiatorType: "employer",
        targetType: "worker",
        targetId: 7,
      })
    );
  });
});

describe("履歷/經歷審核（moderation，P2）權限", () => {
  it("approveProfile/reviewExperience 需 staff", async () => {
    await expect(
      worker().moderation.approveProfile({ id: 7 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      worker().moderation.reviewExperience({ id: 9, approve: true })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("staff approveProfile → 更新為 approved", async () => {
    dbMock.getProfileById.mockResolvedValueOnce({ id: 7 });
    await staff().moderation.approveProfile({ id: 7 });
    expect(dbMock.updateProfile).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ moderationStatus: "approved" })
    );
  });
});

describe("P2 Code Review 修復", () => {
  it("findWorkers.expressInterest 也套 gating：無通過需求單 → FORBIDDEN，不建立意向", async () => {
    dbMock.countApprovedPostingsByEmployer.mockResolvedValueOnce(0);
    await expect(
      employer().findWorkers.expressInterest({ id: 7 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMock.createMatchRequest).not.toHaveBeenCalled();
  });

  it("編輯已通過的履歷（存草稿）強制退回 pending，不會靜默republish", async () => {
    dbMock.getProfileByUserId.mockResolvedValueOnce({
      id: 7,
      userId: 10,
      moderationStatus: "approved",
      publishStatus: "published",
      rejectReason: null,
    });
    await worker().worker.upsertProfile({
      selfIntro: "改成含電話 09xx",
      submit: false,
    });
    expect(dbMock.updateProfile).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ moderationStatus: "pending" })
    );
    expect(dbMock.createProfile).not.toHaveBeenCalled();
  });
});

describe("帳號勾稽（reconcile，客服）", () => {
  it("profiles/searchWorkers/link 需 staff", async () => {
    await expect(worker().reconcile.profiles()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      worker().reconcile.link({ profileId: 7, workerId: 55 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("link：連結公開履歷 ↔ 名冊 workers.id", async () => {
    dbMock.getProfileById.mockResolvedValueOnce({ id: 7, userId: 10 });
    dbMock.getWorkerById.mockResolvedValueOnce({ id: 55, name: "阿明" });
    const res = await staff().reconcile.link({ profileId: 7, workerId: 55 });
    expect(res.success).toBe(true);
    expect(dbMock.setProfileWorkerLink).toHaveBeenCalledWith(7, 55);
  });

  it("link：名冊 workers 不存在 → NOT_FOUND", async () => {
    dbMock.getProfileById.mockResolvedValueOnce({ id: 7 });
    dbMock.getWorkerById.mockResolvedValueOnce(undefined);
    await expect(
      staff().reconcile.link({ profileId: 7, workerId: 999 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(dbMock.setProfileWorkerLink).not.toHaveBeenCalled();
  });

  it("unlink：清除連結", async () => {
    dbMock.getProfileById.mockResolvedValueOnce({ id: 7 });
    await staff().reconcile.unlink({ profileId: 7 });
    expect(dbMock.setProfileWorkerLink).toHaveBeenCalledWith(7, null);
  });
});
