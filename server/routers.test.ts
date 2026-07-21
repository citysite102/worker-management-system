import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock DB functions
vi.mock("./db", () => ({
  getAllManagers: vi
    .fn()
    .mockResolvedValue([{ id: 1, name: "Jacob", createdAt: new Date() }]),
  // create* 一律回傳新資料的 id（number）。mock 若給錯型別，測試就會放過
  // 「procedure 把整包物件當成 id 回傳」這種錯誤。
  createManager: vi.fn().mockResolvedValue(101),
  deleteManager: vi.fn().mockResolvedValue({}),
  getAllWorkers: vi.fn().mockResolvedValue([]),
  getWorkerById: vi.fn().mockResolvedValue(undefined),
  getWorkerByPermitNo: vi.fn().mockResolvedValue(undefined),
  getWorkerByPassportNo: vi.fn().mockResolvedValue(undefined),
  createWorker: vi.fn().mockResolvedValue(201),
  updateWorker: vi.fn().mockResolvedValue({}),
  deleteWorker: vi.fn().mockResolvedValue({}),
  getAllCustomers: vi.fn().mockResolvedValue([]),
  getCustomerById: vi.fn().mockResolvedValue(undefined),
  getCustomerByTaxId: vi.fn().mockResolvedValue(undefined),
  getCustomerByName: vi.fn().mockResolvedValue(undefined),
  createCustomer: vi.fn().mockResolvedValue(301),
  updateCustomer: vi.fn().mockResolvedValue({}),
  deleteCustomer: vi.fn().mockResolvedValue({}),
  getComplianceCandidates: vi.fn().mockResolvedValue([]),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  getUserByEmail: vi.fn().mockResolvedValue(undefined),
  createUser: vi.fn().mockResolvedValue(501),
}));

// 隔離 session 發放（不簽 JWT、不設 cookie）
vi.mock("./_core/auth/session", () => ({
  issueSession: vi.fn().mockResolvedValue(undefined),
  newLocalOpenId: () => "local_test123",
}));

// 密碼驗證：以 "correctpass" 為正解，避免真跑 scrypt
vi.mock("./_core/auth/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("scrypt$salt$hash"),
  verifyPassword: vi.fn().mockImplementation(async pw => pw === "correctpass"),
}));

// 合規候選列的完整欄位骨架（未指定者一律 null），供測試逐案覆寫。
function complianceCand(overrides: Record<string, unknown> = {}) {
  return {
    caseId: 9000,
    caseNo: "GVC25-20200101-000",
    caseName: "測試案",
    caseStatus: "in_progress",
    managerId: 1,
    managerName: "Jacob",
    workerId: 5,
    workerName: "Budi",
    workerNameCn: "布迪",
    workerNameEn: "Budi",
    workerLifecycle: "employed",
    workerLastMedicalExamDate: null,
    approvedStartDate: null,
    continuousEmploymentDate: null,
    approvedEndDate: null,
    employmentPeriodMonths: null,
    terminationDate: null,
    exam6mDate: null,
    exam18mDate: null,
    exam30mDate: null,
    ...overrides,
  };
}

// WS3 硬化後，內部 procedure 需 staff/admin。這些是「行為」測試（非權限測試），
// 因此預設注入一個 admin 使用者；權限矩陣另於 server/marketplace.test.ts 覆蓋。
function createCtx(user: TrpcContext["user"] = ADMIN_CTX_USER): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

const ADMIN_CTX_USER: TrpcContext["user"] = {
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
  preferredLang: null,
  passwordHash: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  lastSignedIn: new Date("2026-01-01T00:00:00Z"),
};

describe("managers.list", () => {
  it("returns manager list", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.managers.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe("Jacob");
  });
});

describe("managers.create", () => {
  it("creates a manager with valid name", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.managers.create({ name: "TestManager" });
    expect(result.success).toBe(true);
    // 前端要靠這個 id 導向新建立的資料
    expect(result.id).toBe(101);
  });

  it("rejects empty name", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.managers.create({ name: "" })).rejects.toThrow();
  });
});

describe("workers.create validation", () => {
  it("rejects invalid resident permit format", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.workers.create({
        name: "測試",
        residentPermitNo: "1234567890", // invalid: starts with digit
        lifecycleStatus: "employed",
        documentStatus: "complete",
        managerId: 1,
      })
    ).rejects.toThrow("居留證統一證號格式不正確");
  });

  it("rejects invalid passport format", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.workers.create({
        name: "測試",
        passportNo: "AB", // too short
        lifecycleStatus: "employed",
        documentStatus: "complete",
        managerId: 1,
      })
    ).rejects.toThrow("護照號碼格式不正確");
  });

  it("rejects employed status with not_started document status", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.workers.create({
        name: "測試",
        residentPermitNo: "A123456789",
        lifecycleStatus: "employed",
        documentStatus: "not_started", // cross-field violation
        managerId: 1,
      })
    ).rejects.toThrow("在職移工的文件狀態不應為未完成");
  });

  it("rejects employed status with pending_supplement document status", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.workers.create({
        name: "測試",
        residentPermitNo: "A123456789",
        lifecycleStatus: "employed",
        documentStatus: "pending_supplement",
        managerId: 1,
      })
    ).rejects.toThrow("在職移工的文件狀態不應為未完成");
  });

  it("rejects invalid phone format", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.workers.create({
        name: "測試",
        residentPermitNo: "A123456789",
        lifecycleStatus: "employed",
        documentStatus: "complete",
        managerId: 1,
        phone: "12345",
      })
    ).rejects.toThrow("電話格式不正確");
  });
});

describe("workers.create externalLink validation", () => {
  it("rejects invalid URL (no protocol)", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.workers.create({
        name: "測試",
        residentPermitNo: "A123456789",
        lifecycleStatus: "employed",
        documentStatus: "complete",
        managerId: 1,
        externalLink: "drive.google.com/file", // missing https://
      })
    ).rejects.toThrow("連結格式不正確");
  });

  it("accepts valid https URL", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.workers.create({
      name: "測試",
      residentPermitNo: "A123456789",
      lifecycleStatus: "employed",
      documentStatus: "complete",
      managerId: 1,
      externalLink: "https://drive.google.com/file/d/abc123",
    });
    expect(result.success).toBe(true);
    expect(result.id).toBe(201);
  });

  it("rejects non-http protocol", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.workers.create({
        name: "測試",
        residentPermitNo: "A123456789",
        lifecycleStatus: "employed",
        documentStatus: "complete",
        managerId: 1,
        externalLink: "ftp://example.com/file",
      })
    ).rejects.toThrow("連結格式不正確");
  });
});

describe("workers.import batch import", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mocks to default state (no duplicate, create succeeds)
    const db = await import("./db");
    vi.mocked(db.getWorkerByPermitNo).mockResolvedValue(undefined);
    vi.mocked(db.getWorkerByPassportNo).mockResolvedValue(undefined);
    vi.mocked(db.createWorker).mockResolvedValue(201);
  });

  it("imports valid rows and returns successCount", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.workers.import({
      rows: [
        {
          name: "測試一",
          residentPermitNo: "A123456789",
          lifecycleStatus: "employed",
          documentStatus: "complete",
          managerId: 1,
        },
        {
          name: "測試二",
          passportNo: "VN123456",
          lifecycleStatus: "preparing_abroad",
          documentStatus: "not_started",
          managerId: 1,
        },
      ],
    });
    expect(result.successCount).toBe(2);
    expect(result.failCount).toBe(0);
  });

  it("reports failure for invalid rows and continues", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.workers.import({
      rows: [
        {
          name: "測試一",
          residentPermitNo: "INVALID", // bad format: not starting with letter
          lifecycleStatus: "employed",
          documentStatus: "complete",
          managerId: 1,
        },
        {
          name: "測試二",
          passportNo: "VN123456",
          lifecycleStatus: "preparing_abroad",
          documentStatus: "not_started",
          managerId: 1,
        },
      ],
    });
    expect(result.successCount).toBe(1);
    expect(result.failCount).toBe(1);
    expect(result.results[0].success).toBe(false);
    expect(result.results[1].success).toBe(true);
  });
});

describe("customers.create validation", () => {
  it("rejects invalid tax ID", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.customers.create({
        name: "測試公司",
        taxId: "12345678", // invalid checksum
        contractStatus: "in_service",
        pricingTier: "standard",
        managerId: 1,
      })
    ).rejects.toThrow("統一編號格式不正確");
  });

  it("accepts valid data without tax ID", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.customers.create({
      name: "測試公司",
      contractStatus: "in_service",
      pricingTier: "standard",
      managerId: 1,
    });
    expect(result.success).toBe(true);
  });
});

describe("auth.register / auth.login（Email/密碼）", () => {
  async function db() {
    return await import("./db");
  }

  it("register：新 Email 建立帳號、回傳 id 與 accountType", async () => {
    const d = await db();
    vi.mocked(d.getUserByEmail).mockResolvedValueOnce(undefined);
    vi.mocked(d.createUser).mockResolvedValueOnce(501);
    const caller = appRouter.createCaller(createCtx());
    const r = await caller.auth.register({
      email: "New@Example.com",
      password: "at-least-8",
      accountType: "worker",
    });
    expect(r).toEqual({ success: true, id: 501, accountType: "worker" });
    // email 應被正規化為小寫
    expect(vi.mocked(d.createUser).mock.calls[0][0]).toMatchObject({
      email: "new@example.com",
      loginMethod: "email",
      accountType: "worker",
    });
  });

  it("register：Email 已存在 → CONFLICT", async () => {
    const d = await db();
    vi.mocked(d.getUserByEmail).mockResolvedValueOnce({ id: 9 } as never);
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.auth.register({
        email: "dup@example.com",
        password: "at-least-8",
        accountType: "employer",
      })
    ).rejects.toThrow("此 Email 已註冊");
  });

  it("register：密碼太短被擋", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.auth.register({
        email: "a@b.com",
        password: "short",
        accountType: "worker",
      })
    ).rejects.toThrow();
  });

  it("login：正確密碼 → success", async () => {
    const d = await db();
    vi.mocked(d.getUserByEmail).mockResolvedValueOnce({
      id: 7,
      openId: "local_x",
      name: "T",
      passwordHash: "scrypt$s$h",
    } as never);
    const caller = appRouter.createCaller(createCtx());
    const r = await caller.auth.login({
      email: "u@example.com",
      password: "correctpass",
    });
    expect(r).toEqual({ success: true });
  });

  it("login：帳號不存在或密碼錯誤 → 皆回同一錯誤（不洩漏 email 是否存在）", async () => {
    const d = await db();
    const caller = appRouter.createCaller(createCtx());
    // 帳號不存在
    vi.mocked(d.getUserByEmail).mockResolvedValueOnce(undefined);
    await expect(
      caller.auth.login({ email: "nobody@example.com", password: "whatever" })
    ).rejects.toThrow("帳號或密碼錯誤");
    // 密碼錯誤
    vi.mocked(d.getUserByEmail).mockResolvedValueOnce({
      id: 7,
      openId: "local_x",
      name: "T",
      passwordHash: "scrypt$s$h",
    } as never);
    await expect(
      caller.auth.login({ email: "u@example.com", password: "wrong" })
    ).rejects.toThrow("帳號或密碼錯誤");
  });
});

describe("dashboard.compliance（法定合規提醒）", () => {
  async function setCandidates(rows: Record<string, unknown>[]) {
    const db = await import("./db");
    vi.mocked(db.getComplianceCandidates).mockResolvedValueOnce(rows as never);
  }

  it("健檢：起始日久遠且未登錄 → 6/18/30 三次逾期；已登錄者不出現", async () => {
    await setCandidates([
      complianceCand({
        caseId: 9001,
        workerId: 5,
        workerNameCn: "布迪",
        approvedStartDate: "2020-01-01",
      }),
      complianceCand({
        caseId: 9002,
        workerId: 6,
        workerNameCn: "莎莉",
        approvedStartDate: "2020-01-01",
        exam6mDate: "2020-07-01",
        exam18mDate: "2021-07-01",
        exam30mDate: "2022-07-01",
      }),
    ]);
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dashboard.compliance();

    const health = result.alerts.filter(a => a.kind === "health_check");
    expect(health).toHaveLength(3);
    expect(health.every(a => a.status === "overdue" && a.workerId === 5)).toBe(
      true
    );
    expect(new Set(health.map(a => a.milestone))).toEqual(new Set([6, 18, 30]));
    expect(result.countsByKind.healthCheck).toEqual({
      overdue: 3,
      dueNow: 0,
      upcoming: 0,
    });

    const m6 = health.find(a => a.milestone === 6)!;
    expect(m6.workerName).toBe("布迪");
    expect(m6.anchorSource).toBe("approved");
    expect(m6.dueDate).toBe("2020-07-01");
  });

  it("健檢資料分兩處：移工檔體檢日落在窗口內 → 該次不再逾期", async () => {
    await setCandidates([
      complianceCand({
        caseId: 9003,
        workerId: 7,
        workerNameCn: "阿里",
        approvedStartDate: "2020-01-01",
        workerLastMedicalExamDate: "2020-07-01", // 落在 6 個月窗口 → 補上
      }),
    ]);
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dashboard.compliance();
    const health = result.alerts.filter(a => a.kind === "health_check");
    // 6m 由移工檔補上，只剩 18m / 30m 逾期
    expect(health.map(a => a.milestone).sort((x, y) => x! - y!)).toEqual([
      18, 30,
    ]);
  });

  it("聘僱許可：核准聘僱截止日已過 → 逾期續聘提醒", async () => {
    await setCandidates([
      complianceCand({
        caseId: 9004,
        workerId: 8,
        workerNameCn: "妮雅",
        approvedStartDate: "2020-01-01",
        approvedEndDate: "2021-01-01",
        exam6mDate: "2020-07-01",
        exam18mDate: "2021-07-01",
        exam30mDate: "2022-07-01",
      }),
    ]);
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dashboard.compliance();
    const permit = result.alerts.filter(a => a.kind === "employment_permit");
    expect(permit).toHaveLength(1);
    expect(permit[0].status).toBe("overdue");
    expect(permit[0].dueDate).toBe("2021-01-01");
    expect(permit[0].title).toBe("聘僱許可續聘");
  });

  it("聘僱許可：無截止日但有期間月數 → 由起始日推算截止日（computed）", async () => {
    await setCandidates([
      complianceCand({
        caseId: 9006,
        workerId: 10,
        workerNameCn: "阿德",
        approvedStartDate: "2020-01-01",
        employmentPeriodMonths: 12, // 推算截止 2021-01-01
        exam6mDate: "2020-07-01",
        exam18mDate: "2021-07-01",
        exam30mDate: "2022-07-01",
      }),
    ]);
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dashboard.compliance();
    const permit = result.alerts.filter(a => a.kind === "employment_permit");
    expect(permit).toHaveLength(1);
    expect(permit[0].dueDate).toBe("2021-01-01");
    expect(permit[0].endDateSource).toBe("computed");
  });

  it("聘僱許可：只有截止日、無起始日 → 仍提醒續聘（不漏接）", async () => {
    await setCandidates([
      complianceCand({
        caseId: 9007,
        workerId: 11,
        workerNameCn: "無起始日",
        approvedStartDate: null,
        continuousEmploymentDate: null,
        approvedEndDate: "2021-01-01",
      }),
    ]);
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dashboard.compliance();
    const permit = result.alerts.filter(a => a.kind === "employment_permit");
    expect(permit).toHaveLength(1);
    expect(permit[0].status).toBe("overdue");
    expect(permit[0].anchorSource).toBeNull();
    // 沒有起始日就無法推算健檢，不應有健檢提醒
    expect(result.alerts.filter(a => a.kind === "health_check")).toHaveLength(
      0
    );
  });

  it("聘僱許可：已終止（terminationDate 有值）不提醒續聘", async () => {
    await setCandidates([
      complianceCand({
        caseId: 9005,
        workerId: 9,
        workerNameCn: "阿明",
        approvedStartDate: "2020-01-01",
        approvedEndDate: "2021-01-01",
        terminationDate: "2020-12-01",
        exam6mDate: "2020-07-01",
        exam18mDate: "2021-07-01",
        exam30mDate: "2022-07-01",
      }),
    ]);
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dashboard.compliance();
    expect(
      result.alerts.filter(a => a.kind === "employment_permit")
    ).toHaveLength(0);
  });
});
