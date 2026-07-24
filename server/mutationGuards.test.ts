/**
 * Mutation 共用守衛與稽核骨架——單元測試（mock ./db 與 ./_core/audit）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

vi.mock("./db", () => ({ insertModerationEvent: vi.fn() }));
vi.mock("./_core/audit", () => ({ logAudit: vi.fn() }));

import { loadOwnedOrThrow, recordModeration } from "./mutationGuards";
import { insertModerationEvent } from "./db";
import { logAudit } from "./_core/audit";

beforeEach(() => vi.clearAllMocks());

describe("loadOwnedOrThrow", () => {
  const fetchById = (row: unknown) => vi.fn().mockResolvedValue(row);

  it("擁有者相符 → 回傳該筆", async () => {
    const row = { id: 5, employerUserId: 10, city: "台北市" };
    const out = await loadOwnedOrThrow(
      fetchById(row),
      5,
      10,
      "employerUserId",
      "找不到"
    );
    expect(out).toBe(row);
  });

  it("查不到（null/undefined）→ NOT_FOUND", async () => {
    await expect(
      loadOwnedOrThrow(fetchById(undefined), 5, 10, "employerUserId", "找不到")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      loadOwnedOrThrow(fetchById(null), 5, 10, "userId", "找不到")
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("非本人 → NOT_FOUND（不洩漏存在性）", async () => {
    const row = { id: 5, employerUserId: 999 };
    await expect(
      loadOwnedOrThrow(
        fetchById(row),
        5,
        10,
        "employerUserId",
        "找不到此需求單"
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "找不到此需求單" });
  });

  it("以指定 ownerField 比對（userId）", async () => {
    const row = { id: 7, userId: 10 };
    const out = await loadOwnedOrThrow(
      fetchById(row),
      7,
      10,
      "userId",
      "找不到"
    );
    expect(out).toBe(row);
  });
});

describe("recordModeration", () => {
  const ctx = { user: { id: 42 }, req: {} } as never;

  it("寫 moderation_events（單數 entityType + staffId 取自 ctx）與 audit（複數 + meta）", async () => {
    await recordModeration(
      ctx,
      { entityType: "job_posting", entityId: 5, action: "approve" },
      {
        action: "moderation.posting.approve",
        entityType: "job_postings",
        meta: { caseId: 88 },
      }
    );
    expect(insertModerationEvent).toHaveBeenCalledWith({
      entityType: "job_posting",
      entityId: 5,
      action: "approve",
      reason: null,
      staffId: 42,
    });
    expect(logAudit).toHaveBeenCalledWith(ctx, {
      action: "moderation.posting.approve",
      entityType: "job_postings",
      entityId: 5,
      meta: { caseId: 88 },
    });
  });

  it("帶 reason 時寫入 moderation_events；entityId 兩筆共用", async () => {
    await recordModeration(
      ctx,
      {
        entityType: "job_posting",
        entityId: 9,
        action: "reject",
        reason: "incomplete:缺資料",
      },
      { action: "moderation.posting.reject", entityType: "job_postings" }
    );
    expect(insertModerationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "incomplete:缺資料", entityId: 9 })
    );
    expect(logAudit).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ entityId: 9, meta: undefined })
    );
  });

  it("兩筆都會寫（同進同出）", async () => {
    await recordModeration(
      ctx,
      { entityType: "worker_profile", entityId: 3, action: "approve" },
      {
        action: "moderation.profile.approve",
        entityType: "worker_public_profiles",
      }
    );
    expect(insertModerationEvent).toHaveBeenCalledTimes(1);
    expect(logAudit).toHaveBeenCalledTimes(1);
  });
});
