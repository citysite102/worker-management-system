/**
 * approvePostingToCase 深模組單元測試 —— 直接呼叫，不經 tRPC caller。
 * 重點：把「中途失敗 → 回滾成待審」這個不變量變成可直接斷言（以前只能透過 caller）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  getJobPostingById: vi.fn(),
  claimJobPostingForApproval: vi.fn().mockResolvedValue(true),
  getUserById: vi.fn().mockResolvedValue({ id: 9, name: "王雇主" }),
  createCustomer: vi.fn().mockResolvedValue(301),
  createCase: vi.fn().mockResolvedValue(401),
  createQualification: vi.fn().mockResolvedValue(501),
  createDemand: vi.fn().mockResolvedValue(undefined),
  updateJobPosting: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./db", () => db);
const recordModeration = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("./mutationGuards", () => ({ recordModeration }));

import { approvePostingToCase } from "./moderation";

const ctx = { user: { id: 1 }, req: {} } as never;

function posting(over = {}) {
  return {
    id: 5,
    status: "pending_review",
    customerId: null,
    employerUserId: 9,
    jobType: "caregiver",
    city: "臺北市",
    headcount: 2,
    ...over,
  };
}

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockClear();
  recordModeration.mockClear();
  db.claimJobPostingForApproval.mockResolvedValue(true);
  db.createCase.mockResolvedValue(401);
});

describe("approvePostingToCase", () => {
  it("找不到需求單 → NOT_FOUND", async () => {
    db.getJobPostingById.mockResolvedValueOnce(undefined);
    await expect(
      approvePostingToCase(ctx, { id: 5, managerId: 7 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("非待審狀態 → BAD_REQUEST，不搶佔", async () => {
    db.getJobPostingById.mockResolvedValueOnce(posting({ status: "approved" }));
    await expect(
      approvePostingToCase(ctx, { id: 5, managerId: 7 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.claimJobPostingForApproval).not.toHaveBeenCalled();
  });

  it("搶佔失敗（已被他人處理）→ BAD_REQUEST，不建案件", async () => {
    db.getJobPostingById.mockResolvedValueOnce(posting());
    db.claimJobPostingForApproval.mockResolvedValueOnce(false);
    await expect(
      approvePostingToCase(ctx, { id: 5, managerId: 7 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.createCase).not.toHaveBeenCalled();
  });

  it("happy（無既有 customer）→ 自動建 stub、建案件、雙寫稽核", async () => {
    db.getJobPostingById.mockResolvedValueOnce(posting({ customerId: null }));
    const r = await approvePostingToCase(ctx, { id: 5, managerId: 7 });
    expect(r).toEqual({ success: true, caseId: 401 });
    expect(db.createCustomer).toHaveBeenCalledTimes(1);
    expect(db.createCase).toHaveBeenCalledTimes(1);
    expect(db.createDemand.mock.calls[0][0]).toMatchObject({ publicHidden: 1 });
    expect(recordModeration).toHaveBeenCalledTimes(1);
  });

  it("happy（已勾稽 customer）→ 不重建 customer", async () => {
    db.getJobPostingById.mockResolvedValueOnce(posting({ customerId: 77 }));
    await approvePostingToCase(ctx, { id: 5, managerId: 7 });
    expect(db.createCustomer).not.toHaveBeenCalled();
  });

  it("建案件中途失敗 → 回滾成 pending_review 並把錯往外拋（不變量）", async () => {
    db.getJobPostingById.mockResolvedValueOnce(posting());
    db.createCase.mockRejectedValueOnce(new Error("boom"));
    await expect(
      approvePostingToCase(ctx, { id: 5, managerId: 7 })
    ).rejects.toThrow("boom");
    // 回滾：把狀態還原成待審
    expect(db.updateJobPosting).toHaveBeenCalledWith(5, {
      status: "pending_review",
    });
    expect(recordModeration).not.toHaveBeenCalled();
  });
});
