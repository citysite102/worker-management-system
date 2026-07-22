import { describe, expect, it } from "vitest";
import {
  createCaller,
  createAnonymousCaller,
  ADMIN_USER,
} from "./__tests__/helpers/caller";
import { makeCaseWorld } from "./__tests__/helpers/fixtures";
import { query } from "./__tests__/helpers/testDb";

// 指定 customerId 的 employer 帳號 caller（授權門檻只看 role + customerId）
const employerCaller = (userId: number, customerId: number) =>
  createCaller({
    ...ADMIN_USER,
    id: userId,
    role: "user",
    accountType: "employer",
    workerId: null,
    customerId,
  });

/** 直接寫一段聘僱（case_employments），回傳其 id。 */
async function seedEmployment(
  caseId: number,
  workerId: number,
  opts: { status?: string; contractEnd?: string | null } = {}
): Promise<number> {
  const status = opts.status ?? "terminated";
  const contractEnd =
    opts.contractEnd === undefined ? "2026-05-01" : opts.contractEnd;
  await query(
    "INSERT INTO `case_employments` (caseId, workerId, status, contractEnd) VALUES (?, ?, ?, ?)",
    [caseId, workerId, status, contractEnd]
  );
  const rows = await query<{ id: number }>(
    "SELECT id FROM `case_employments` WHERE caseId = ? AND workerId = ? ORDER BY id DESC LIMIT 1",
    [caseId, workerId]
  );
  return rows[0].id;
}

/** 直接建一份連結到 workerId 的公開履歷（供聚合重算落點）。 */
async function seedProfile(userId: number, workerId: number): Promise<void> {
  await query(
    "INSERT INTO `worker_public_profiles` (userId, workerId, alias, publishStatus, moderationStatus) VALUES (?, ?, ?, 'published', 'approved')",
    [userId, workerId, "阿明"]
  );
}

describe("ratings 整合（real db）", () => {
  it("該案雇主對已完成聘僱評分 → 寫入 ratings 並重算 profile 聚合", async () => {
    const admin = createCaller();
    const { customerId, workerId, caseId } = await makeCaseWorld(admin);
    const empId = await seedEmployment(caseId, workerId);
    await seedProfile(9001, workerId);

    await employerCaller(9, customerId).ratings.create({
      employmentId: empId,
      score: 5,
      comment: "很棒",
    });

    const ratingRows = await query<{
      score: number;
      workerId: number;
      raterUserId: number;
    }>(
      "SELECT score, workerId, raterUserId FROM `ratings` WHERE employmentId = ?",
      [empId]
    );
    expect(ratingRows).toHaveLength(1);
    expect(ratingRows[0]).toMatchObject({ score: 5, workerId, raterUserId: 9 });

    const prof = await query<{ ratingAvg: number; ratingCount: number }>(
      "SELECT ratingAvg, ratingCount FROM `worker_public_profiles` WHERE workerId = ?",
      [workerId]
    );
    expect(prof[0]).toEqual({ ratingAvg: 50, ratingCount: 1 }); // 5.0 ×10
  });

  it("多筆評分 → 平均×10 正確", async () => {
    const admin = createCaller();
    const { customerId, workerId, caseId } = await makeCaseWorld(admin);
    const e1 = await seedEmployment(caseId, workerId);
    const e2 = await seedEmployment(caseId, workerId);
    await seedProfile(9002, workerId);

    await employerCaller(9, customerId).ratings.create({
      employmentId: e1,
      score: 4,
    });
    await employerCaller(9, customerId).ratings.create({
      employmentId: e2,
      score: 5,
    });

    const prof = await query<{ ratingAvg: number; ratingCount: number }>(
      "SELECT ratingAvg, ratingCount FROM `worker_public_profiles` WHERE workerId = ?",
      [workerId]
    );
    expect(prof[0]).toEqual({ ratingAvg: 45, ratingCount: 2 }); // (4+5)/2=4.5 ×10
  });

  it("在職（active、未到期）不可評分", async () => {
    const admin = createCaller();
    const { customerId, workerId, caseId } = await makeCaseWorld(admin);
    const empId = await seedEmployment(caseId, workerId, {
      status: "active",
      contractEnd: null,
    });
    await expect(
      employerCaller(9, customerId).ratings.create({
        employmentId: empId,
        score: 5,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const ratingRows = await query(
      "SELECT id FROM `ratings` WHERE employmentId = ?",
      [empId]
    );
    expect(ratingRows).toHaveLength(0);
  });

  it("非該案雇主不可評分", async () => {
    const admin = createCaller();
    const { workerId, caseId } = await makeCaseWorld(admin);
    const empId = await seedEmployment(caseId, workerId);
    await expect(
      employerCaller(8, 999999).ratings.create({
        employmentId: empId,
        score: 5,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("重複評分同一聘僱 → CONFLICT", async () => {
    const admin = createCaller();
    const { customerId, workerId, caseId } = await makeCaseWorld(admin);
    const empId = await seedEmployment(caseId, workerId);
    await employerCaller(9, customerId).ratings.create({
      employmentId: empId,
      score: 5,
    });
    await expect(
      employerCaller(9, customerId).ratings.create({
        employmentId: empId,
        score: 3,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("forWorker 回傳去識別評分清單", async () => {
    const admin = createCaller();
    const { customerId, workerId, caseId } = await makeCaseWorld(admin);
    const empId = await seedEmployment(caseId, workerId);
    await employerCaller(9, customerId).ratings.create({
      employmentId: empId,
      score: 5,
      comment: "準時可靠",
    });
    // forWorker 需登入；匿名應被擋，登入者可讀
    await expect(
      createAnonymousCaller().ratings.forWorker({ workerId })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const rows = await employerCaller(9, customerId).ratings.forWorker({
      workerId,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ score: 5, comment: "準時可靠" });
  });
});
