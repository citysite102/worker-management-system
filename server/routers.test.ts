import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock DB functions
vi.mock("./db", () => ({
  getAllManagers: vi.fn().mockResolvedValue([
    { id: 1, name: "Jacob", createdAt: new Date() },
  ]),
  createManager: vi.fn().mockResolvedValue({}),
  deleteManager: vi.fn().mockResolvedValue({}),
  getAllWorkers: vi.fn().mockResolvedValue([]),
  getWorkerById: vi.fn().mockResolvedValue(undefined),
  getWorkerByIdNumber: vi.fn().mockResolvedValue(undefined),
  createWorker: vi.fn().mockResolvedValue({}),
  updateWorker: vi.fn().mockResolvedValue({}),
  deleteWorker: vi.fn().mockResolvedValue({}),
  getAllCustomers: vi.fn().mockResolvedValue([]),
  getCustomerById: vi.fn().mockResolvedValue(undefined),
  getCustomerByTaxId: vi.fn().mockResolvedValue(undefined),
  getCustomerByName: vi.fn().mockResolvedValue(undefined),
  createCustomer: vi.fn().mockResolvedValue({}),
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
        idType: "resident_permit",
        idNumber: "1234567890", // invalid: starts with digit
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
        idType: "passport",
        idNumber: "AB", // too short
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
        idType: "resident_permit",
        idNumber: "A123456789",
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
        idType: "resident_permit",
        idNumber: "A123456789",
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
        idType: "resident_permit",
        idNumber: "A123456789",
        lifecycleStatus: "employed",
        documentStatus: "complete",
        managerId: 1,
        phone: "12345",
      })
    ).rejects.toThrow("電話格式不正確");
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
