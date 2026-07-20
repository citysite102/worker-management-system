import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock DB functions
vi.mock("./db", () => ({
  getAllManagers: vi.fn().mockResolvedValue([
    { id: 1, name: "Jacob", createdAt: new Date() },
  ]),
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
}));

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

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
