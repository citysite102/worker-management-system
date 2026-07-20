/**
 * 案件四個子 router 的整合測試 —— 打真實 MySQL，不 mock db。
 *
 * 涵蓋 caseQualifications / caseDemands / caseAssignments / caseEmployments。
 * 重點放在 mock 測不到的部分：
 *   - 資料真的寫進子表（欄位對映、預設值、可選欄位落成 NULL）
 *   - 驗證失敗時不留下半筆資料
 *   - 跨案件的資料隔離（listByCase 不會撈到別的案件）
 *   - 成員階段轉換如何影響 quotaUsed / 需求進度
 *   - 刪除父層後子表不留孤兒、被引用的外鍵有沒有解除連結
 *   - 同案件同移工的唯一性衝突
 */
import { describe, expect, it } from "vitest";
import { createCaller } from "./__tests__/helpers/caller";
import {
  demandInput,
  makeCase,
  makeCaseWorld,
  makeWorker,
} from "./__tests__/helpers/fixtures";
import { query } from "./__tests__/helpers/testDb";

/** case_qualifications 的最小合法輸入。 */
function qualInput(overrides: Record<string, unknown> = {}) {
  return {
    label: "案件資格一(看護)",
    category: "labor_in" as const,
    qualType: "caregiver" as const,
    ...overrides,
  };
}

/**
 * 建一個「資格 + 配對 + 一位成員」的組合，並把成員推到指定階段。
 * quotaUsed 與需求進度都是靠成員階段算出來的，很多測試都需要這組前置資料。
 */
async function makeMemberAtStage(
  caller: ReturnType<typeof createCaller>,
  opts: {
    caseId: number;
    workerId: number;
    stage:
      | "candidate"
      | "confirmed"
      | "upcoming"
      | "employed"
      | "departed"
      | "rejected";
    qualificationId?: number;
    demandId?: number;
  }
) {
  const { assignmentId } = await caller.caseAssignments.create({
    caseId: opts.caseId,
    workerIds: [opts.workerId],
    qualificationId: opts.qualificationId,
    demandId: opts.demandId,
  });
  const members = await caller.caseAssignments.getMembersByCaseId({
    caseId: opts.caseId,
  });
  const member = members.find(m => m.assignmentId === assignmentId)!;
  if (opts.stage !== "candidate") {
    await caller.caseAssignments.updateMemberStage({
      memberId: member.id,
      stage: opts.stage,
    });
  }
  return { assignmentId, memberId: member.id };
}

// ─── caseQualifications ─────────────────────────────────────────────────────

describe("caseQualifications.create", () => {
  it("實際寫入資料庫並可讀回", async () => {
    const caller = createCaller();
    const { caseId } = await makeCaseWorld(caller);

    const result = await caller.caseQualifications.create({
      caseId,
      ...qualInput({
        label: "幫傭資格",
        qualType: "domestic_helper",
        quotaTotal: 3,
      }),
    });

    expect(result).toMatchObject({ success: true });
    expect(result.id).toBeGreaterThan(0);

    const rows = await query<{
      caseId: number;
      label: string;
      qualType: string;
      applicationStatus: string;
      quotaTotal: number;
    }>(
      "SELECT caseId, label, qualType, applicationStatus, quotaTotal FROM case_qualifications WHERE id = ?",
      [result.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].caseId).toBe(caseId);
    expect(rows[0].label).toBe("幫傭資格");
    expect(rows[0].qualType).toBe("domestic_helper");
    // applicationStatus 沒傳，應套用 schema 預設值
    expect(rows[0].applicationStatus).toBe("preparing");
    expect(rows[0].quotaTotal).toBe(3);
  });

  it("未填的可選欄位在資料庫是 NULL，不是空字串", async () => {
    const caller = createCaller();
    const { caseId } = await makeCaseWorld(caller);

    const { id } = await caller.caseQualifications.create({
      caseId,
      ...qualInput({ employerName: "   " }),
    });

    const rows = await query<{
      employerName: string | null;
      employerTaxId: string | null;
      notes: string | null;
    }>(
      "SELECT employerName, employerTaxId, notes FROM case_qualifications WHERE id = ?",
      [id]
    );
    // employerName 傳了整串空白，transform 後應視同未填
    expect(rows[0].employerName).toBeNull();
    expect(rows[0].employerTaxId).toBeNull();
    expect(rows[0].notes).toBeNull();
  });

  it("拒絕空白的 label，且不留下半筆資料", async () => {
    const caller = createCaller();
    const { caseId } = await makeCaseWorld(caller);

    await expect(
      caller.caseQualifications.create({ caseId, ...qualInput({ label: "" }) })
    ).rejects.toThrow();

    expect(await query("SELECT id FROM case_qualifications")).toHaveLength(0);
  });
});

describe("caseQualifications.listByCase", () => {
  it("只回傳該案件的資格（跨案件隔離）", async () => {
    const caller = createCaller();
    const { caseId, customerId, managerId } = await makeCaseWorld(caller);
    const otherCaseId = await makeCase(caller, customerId, managerId, {
      name: "另一個案件",
    });

    await caller.caseQualifications.create({
      caseId,
      ...qualInput({ label: "本案資格" }),
    });
    await caller.caseQualifications.create({
      caseId: otherCaseId,
      ...qualInput({ label: "他案資格" }),
    });

    const result = await caller.caseQualifications.listByCase({ caseId });

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("本案資格");
  });

  it("quotaUsed 只計 employed 階段的成員，quotaRemaining 隨之遞減", async () => {
    const caller = createCaller();
    const { caseId, managerId, workerId } = await makeCaseWorld(caller);
    const { id: qualificationId } = await caller.caseQualifications.create({
      caseId,
      ...qualInput({ quotaTotal: 2 }),
    });

    // 一位 employed（會被算進 quotaUsed）、一位 confirmed（不算）
    const otherWorkerId = await makeWorker(caller, managerId, {
      name: "移工乙",
    });
    await makeMemberAtStage(caller, {
      caseId,
      workerId,
      stage: "employed",
      qualificationId,
    });
    await makeMemberAtStage(caller, {
      caseId,
      workerId: otherWorkerId,
      stage: "confirmed",
      qualificationId,
    });

    const [row] = await caller.caseQualifications.listByCase({ caseId });

    expect(row.quotaUsed).toBe(1);
    expect(row.quotaRemaining).toBe(1);
  });

  it("沒有資格時回傳空陣列而非報錯", async () => {
    const caller = createCaller();
    const { caseId } = await makeCaseWorld(caller);
    await expect(
      caller.caseQualifications.listByCase({ caseId })
    ).resolves.toEqual([]);
  });
});

describe("caseQualifications.getById", () => {
  it("回傳單筆資格並附上額度計算", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);
    const { id } = await caller.caseQualifications.create({
      caseId,
      ...qualInput({
        label: "製造業資格",
        qualType: "manufacturing",
        quotaTotal: 5,
      }),
    });
    await makeMemberAtStage(caller, {
      caseId,
      workerId,
      stage: "employed",
      qualificationId: id,
    });

    const result = await caller.caseQualifications.getById({ id });

    expect(result.label).toBe("製造業資格");
    expect(result.quotaUsed).toBe(1);
    expect(result.quotaRemaining).toBe(4);
  });

  it("查無資料時拋出 NOT_FOUND", async () => {
    const caller = createCaller();
    await expect(
      caller.caseQualifications.getById({ id: 999999 })
    ).rejects.toThrow(/找不到/);
  });
});

describe("caseQualifications.update", () => {
  it("更新真的寫回資料庫", async () => {
    const caller = createCaller();
    const { caseId } = await makeCaseWorld(caller);
    const { id } = await caller.caseQualifications.create({
      caseId,
      ...qualInput(),
    });

    await caller.caseQualifications.update({
      id,
      ...qualInput({ label: "改過的資格" }),
      applicationStatus: "approved",
      quotaTotal: 8,
      docValidUntil: "2027-12-31",
    });

    const fetched = await caller.caseQualifications.getById({ id });
    expect(fetched.label).toBe("改過的資格");
    expect(fetched.applicationStatus).toBe("approved");
    expect(fetched.quotaTotal).toBe(8);
    expect(fetched.docValidUntil).toBe("2027-12-31");
    // 更新不該動到所屬案件
    expect(fetched.caseId).toBe(caseId);
  });
});

describe("caseQualifications.delete", () => {
  it("刪除資格後，引用它的配對只解除連結、不被一起刪掉", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);
    const { id: qualificationId } = await caller.caseQualifications.create({
      caseId,
      ...qualInput(),
    });
    const { assignmentId } = await makeMemberAtStage(caller, {
      caseId,
      workerId,
      stage: "candidate",
      qualificationId,
    });

    await caller.caseQualifications.delete({ id: qualificationId });

    expect(
      await query("SELECT id FROM case_qualifications WHERE id = ?", [
        qualificationId,
      ])
    ).toHaveLength(0);
    const rows = await query<{ qualificationId: number | null }>(
      "SELECT qualificationId FROM case_assignments WHERE id = ?",
      [assignmentId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].qualificationId).toBeNull();
  });
});

// ─── caseDemands ────────────────────────────────────────────────────────────

describe("caseDemands.create", () => {
  it("實際寫入資料庫並套用預設狀態", async () => {
    const caller = createCaller();
    const { caseId } = await makeCaseWorld(caller);

    const result = await caller.caseDemands.create({
      caseId,
      ...demandInput({ label: "看護兩名", neededCount: 2 }),
    });

    expect(result).toMatchObject({ success: true });
    const rows = await query<{
      caseId: number;
      label: string;
      neededCount: number;
      status: string;
      qualificationId: number | null;
    }>(
      "SELECT caseId, label, neededCount, status, qualificationId FROM case_demands WHERE id = ?",
      [result.id]
    );
    expect(rows[0]).toMatchObject({
      caseId,
      label: "看護兩名",
      neededCount: 2,
      status: "open",
    });
    expect(rows[0].qualificationId).toBeNull();
  });

  it("可綁定案件資格", async () => {
    const caller = createCaller();
    const { caseId } = await makeCaseWorld(caller);
    const { id: qualificationId } = await caller.caseQualifications.create({
      caseId,
      ...qualInput(),
    });

    const { id } = await caller.caseDemands.create({
      caseId,
      ...demandInput({ qualificationId }),
    });

    const rows = await query<{ qualificationId: number }>(
      "SELECT qualificationId FROM case_demands WHERE id = ?",
      [id]
    );
    expect(rows[0].qualificationId).toBe(qualificationId);
  });

  it("拒絕 neededCount 為 0，且不留下半筆資料", async () => {
    const caller = createCaller();
    const { caseId } = await makeCaseWorld(caller);

    await expect(
      caller.caseDemands.create({ caseId, ...demandInput({ neededCount: 0 }) })
    ).rejects.toThrow();

    expect(await query("SELECT id FROM case_demands")).toHaveLength(0);
  });
});

describe("caseDemands.listByCase", () => {
  it("只回傳該案件的需求（跨案件隔離）", async () => {
    const caller = createCaller();
    const { caseId, customerId, managerId } = await makeCaseWorld(caller);
    const otherCaseId = await makeCase(caller, customerId, managerId, {
      name: "另一個案件",
    });

    await caller.caseDemands.create({
      caseId,
      ...demandInput({ label: "本案需求" }),
    });
    await caller.caseDemands.create({
      caseId: otherCaseId,
      ...demandInput({ label: "他案需求" }),
    });

    const result = await caller.caseDemands.listByCase({ caseId });
    expect(result.map(d => d.label)).toEqual(["本案需求"]);
  });

  it("進度依成員階段計算：confirmed 以上算媒合、employed 另計", async () => {
    const caller = createCaller();
    const { caseId, managerId, workerId } = await makeCaseWorld(caller);
    const { id: demandId } = await caller.caseDemands.create({
      caseId,
      ...demandInput({ neededCount: 4 }),
    });

    const w2 = await makeWorker(caller, managerId, { name: "移工乙" });
    const w3 = await makeWorker(caller, managerId, { name: "移工丙" });
    await makeMemberAtStage(caller, {
      caseId,
      workerId,
      stage: "employed",
      demandId,
    });
    await makeMemberAtStage(caller, {
      caseId,
      workerId: w2,
      stage: "confirmed",
      demandId,
    });
    // candidate 還在評估，不該算進媒合數
    await makeMemberAtStage(caller, {
      caseId,
      workerId: w3,
      stage: "candidate",
      demandId,
    });

    const [row] = await caller.caseDemands.listByCase({ caseId });

    expect(row.matchedCount).toBe(2);
    expect(row.employedCount).toBe(1);
    expect(row.progress).toBe(50); // 2 / 4
  });

  it("沒有任何配對時進度為 0", async () => {
    const caller = createCaller();
    const { caseId } = await makeCaseWorld(caller);
    await caller.caseDemands.create({
      caseId,
      ...demandInput({ neededCount: 3 }),
    });

    const [row] = await caller.caseDemands.listByCase({ caseId });
    expect(row).toMatchObject({
      matchedCount: 0,
      employedCount: 0,
      progress: 0,
    });
  });
});

describe("caseDemands.update", () => {
  it("更新真的寫回資料庫", async () => {
    const caller = createCaller();
    const { caseId } = await makeCaseWorld(caller);
    const { id } = await caller.caseDemands.create({
      caseId,
      ...demandInput(),
    });

    await caller.caseDemands.update({
      id,
      ...demandInput({ label: "改過的需求", neededCount: 5 }),
      status: "fulfilled",
    });

    const rows = await query<{
      label: string;
      neededCount: number;
      status: string;
    }>("SELECT label, neededCount, status FROM case_demands WHERE id = ?", [
      id,
    ]);
    expect(rows[0]).toMatchObject({
      label: "改過的需求",
      neededCount: 5,
      status: "fulfilled",
    });
  });
});

describe("caseDemands.delete", () => {
  it("刪除需求後，引用它的配對只解除連結、不被一起刪掉", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);
    const { id: demandId } = await caller.caseDemands.create({
      caseId,
      ...demandInput(),
    });
    const { assignmentId } = await makeMemberAtStage(caller, {
      caseId,
      workerId,
      stage: "candidate",
      demandId,
    });

    await caller.caseDemands.delete({ id: demandId });

    expect(
      await query("SELECT id FROM case_demands WHERE id = ?", [demandId])
    ).toHaveLength(0);
    const rows = await query<{ demandId: number | null }>(
      "SELECT demandId FROM case_assignments WHERE id = ?",
      [assignmentId]
    );
    expect(rows[0].demandId).toBeNull();
  });
});

// ─── caseAssignments ────────────────────────────────────────────────────────

describe("caseAssignments.create", () => {
  it("同時寫入配對與成員，成員預設在 candidate 階段", async () => {
    const caller = createCaller();
    const { caseId, managerId, workerId } = await makeCaseWorld(caller);
    const w2 = await makeWorker(caller, managerId, { name: "移工乙" });

    const result = await caller.caseAssignments.create({
      caseId,
      label: "第一批",
      workerIds: [workerId, w2],
    });

    expect(result).toMatchObject({ success: true });
    expect(result.assignmentId).toBeGreaterThan(0);

    const members = await query<{
      caseId: number;
      workerId: number;
      stage: string;
    }>(
      "SELECT caseId, workerId, stage FROM case_assignment_workers WHERE assignmentId = ? ORDER BY id",
      [result.assignmentId]
    );
    expect(members).toHaveLength(2);
    expect(members.map(m => m.workerId)).toEqual([workerId, w2]);
    expect(members.every(m => m.stage === "candidate")).toBe(true);
    // caseId 是冗餘欄位，必須跟著配對一起寫對，否則唯一性檢查會失準
    expect(members.every(m => m.caseId === caseId)).toBe(true);
  });

  it("同案件同移工重複配對時拋出 CONFLICT", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);
    await caller.caseAssignments.create({ caseId, workerIds: [workerId] });

    await expect(
      caller.caseAssignments.create({ caseId, workerIds: [workerId] })
    ).rejects.toThrow(/已在本案件配對中/);
  });

  it("衝突時不留下半筆配對（檢查發生在寫入之前）", async () => {
    const caller = createCaller();
    const { caseId, managerId, workerId } = await makeCaseWorld(caller);
    const w2 = await makeWorker(caller, managerId, { name: "移工乙" });
    await caller.caseAssignments.create({ caseId, workerIds: [workerId] });

    // 這批裡只有一位衝突，但整批都不該被建立
    await expect(
      caller.caseAssignments.create({ caseId, workerIds: [w2, workerId] })
    ).rejects.toThrow();

    expect(
      await query("SELECT id FROM case_assignments WHERE caseId = ?", [caseId])
    ).toHaveLength(1);
    expect(
      await query("SELECT id FROM case_assignment_workers WHERE workerId = ?", [
        w2,
      ])
    ).toHaveLength(0);
  });

  it("已 rejected / departed 的成員不擋住重新配對", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);
    await makeMemberAtStage(caller, { caseId, workerId, stage: "rejected" });

    await expect(
      caller.caseAssignments.create({ caseId, workerIds: [workerId] })
    ).resolves.toMatchObject({ success: true });
  });

  it("同一位移工在不同案件可各自配對", async () => {
    const caller = createCaller();
    const { caseId, customerId, managerId, workerId } =
      await makeCaseWorld(caller);
    const otherCaseId = await makeCase(caller, customerId, managerId, {
      name: "另一個案件",
    });

    await caller.caseAssignments.create({ caseId, workerIds: [workerId] });
    await expect(
      caller.caseAssignments.create({
        caseId: otherCaseId,
        workerIds: [workerId],
      })
    ).resolves.toMatchObject({ success: true });
  });

  it("拒絕空的移工清單，且不留下半筆配對", async () => {
    const caller = createCaller();
    const { caseId } = await makeCaseWorld(caller);

    await expect(
      caller.caseAssignments.create({ caseId, workerIds: [] })
    ).rejects.toThrow();

    expect(await query("SELECT id FROM case_assignments")).toHaveLength(0);
  });
});

describe("caseAssignments.listByCase", () => {
  it("每個配對帶出自己的成員與移工資料", async () => {
    const caller = createCaller();
    const { caseId, managerId, workerId } = await makeCaseWorld(caller);
    // workers.create 的顯示名是 nameCn || nameEn || name，所以要斷言名字就得帶 nameCn
    const w2 = await makeWorker(caller, managerId, {
      nameCn: "阮氏梅",
      nationality: "越南",
    });

    await caller.caseAssignments.create({
      caseId,
      label: "第一批",
      workerIds: [workerId],
    });
    await caller.caseAssignments.create({
      caseId,
      label: "第二批",
      workerIds: [w2],
    });

    const result = await caller.caseAssignments.listByCase({ caseId });

    expect(result.map(a => a.label)).toEqual(["第一批", "第二批"]);
    expect(result[0].members).toHaveLength(1);
    expect(result[1].members[0]).toMatchObject({
      workerId: w2,
      workerName: "阮氏梅",
      workerNationality: "越南",
      workerLifecycleStatus: "idle_in_tw",
    });
  });

  it("stage 過濾只影響成員清單，配對本身仍全部回傳", async () => {
    const caller = createCaller();
    const { caseId, managerId, workerId } = await makeCaseWorld(caller);
    const w2 = await makeWorker(caller, managerId, { name: "移工乙" });
    await makeMemberAtStage(caller, { caseId, workerId, stage: "employed" });
    await makeMemberAtStage(caller, {
      caseId,
      workerId: w2,
      stage: "candidate",
    });

    const result = await caller.caseAssignments.listByCase({
      caseId,
      stage: "employed",
    });

    expect(result).toHaveLength(2);
    expect(result.flatMap(a => a.members)).toHaveLength(1);
    expect(result.flatMap(a => a.members)[0].workerId).toBe(workerId);
  });

  it("不會撈到別的案件的配對", async () => {
    const caller = createCaller();
    const { caseId, customerId, managerId, workerId } =
      await makeCaseWorld(caller);
    const otherCaseId = await makeCase(caller, customerId, managerId, {
      name: "另一個案件",
    });
    await caller.caseAssignments.create({
      caseId: otherCaseId,
      workerIds: [workerId],
    });

    await expect(
      caller.caseAssignments.listByCase({ caseId })
    ).resolves.toEqual([]);
  });
});

describe("caseAssignments.addWorker", () => {
  it("把移工加進既有配對", async () => {
    const caller = createCaller();
    const { caseId, managerId, workerId } = await makeCaseWorld(caller);
    const w2 = await makeWorker(caller, managerId, { name: "移工乙" });
    const { assignmentId } = await caller.caseAssignments.create({
      caseId,
      workerIds: [workerId],
    });

    await caller.caseAssignments.addWorker({ assignmentId, workerId: w2 });

    const members = await query<{
      workerId: number;
      caseId: number;
      stage: string;
    }>(
      "SELECT workerId, caseId, stage FROM case_assignment_workers WHERE assignmentId = ? ORDER BY id",
      [assignmentId]
    );
    expect(members).toHaveLength(2);
    expect(members[1]).toMatchObject({
      workerId: w2,
      caseId,
      stage: "candidate",
    });
  });

  it("同案件已有進行中成員時拋出 CONFLICT（即使掛在另一個配對下）", async () => {
    const caller = createCaller();
    const { caseId, managerId, workerId } = await makeCaseWorld(caller);
    const w2 = await makeWorker(caller, managerId, { name: "移工乙" });
    // workerId 掛在第一批，接著想把他加進第二批 —— 唯一性的範圍是「案件」，不是「配對」
    await caller.caseAssignments.create({ caseId, workerIds: [workerId] });
    const second = await caller.caseAssignments.create({
      caseId,
      workerIds: [w2],
    });

    await expect(
      caller.caseAssignments.addWorker({
        assignmentId: second.assignmentId,
        workerId,
      })
    ).rejects.toThrow(/已在本案件配對中/);

    expect(
      await query(
        "SELECT id FROM case_assignment_workers WHERE assignmentId = ?",
        [second.assignmentId]
      )
    ).toHaveLength(1);
  });

  it("配對不存在時拋出 NOT_FOUND，且不新增成員", async () => {
    const caller = createCaller();
    const { workerId } = await makeCaseWorld(caller);

    await expect(
      caller.caseAssignments.addWorker({ assignmentId: 999999, workerId })
    ).rejects.toThrow(/找不到此配對/);

    expect(await query("SELECT id FROM case_assignment_workers")).toHaveLength(
      0
    );
  });
});

describe("caseAssignments.updateMember / updateMemberStage", () => {
  it("updateMember 寫入媒合備註與預計日期", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);
    const { memberId } = await makeMemberAtStage(caller, {
      caseId,
      workerId,
      stage: "candidate",
    });

    await caller.caseAssignments.updateMember({
      memberId,
      matchNote: "雇主面試通過",
      expectedEntryDate: "2026-09-01",
    });

    const rows = await query<{
      matchNote: string;
      expectedEntryDate: string;
      stage: string;
    }>(
      "SELECT matchNote, expectedEntryDate, stage FROM case_assignment_workers WHERE id = ?",
      [memberId]
    );
    expect(rows[0].matchNote).toBe("雇主面試通過");
    expect(rows[0].expectedEntryDate).toBe("2026-09-01");
    // updateMember 不該動到階段
    expect(rows[0].stage).toBe("candidate");
  });

  it("階段可一路推進到 employed，並反映在資格額度上", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);
    const { id: qualificationId } = await caller.caseQualifications.create({
      caseId,
      ...qualInput({ quotaTotal: 1 }),
    });
    const { memberId } = await makeMemberAtStage(caller, {
      caseId,
      workerId,
      stage: "candidate",
      qualificationId,
    });

    expect(
      (await caller.caseQualifications.getById({ id: qualificationId }))
        .quotaUsed
    ).toBe(0);

    for (const stage of ["confirmed", "upcoming", "employed"] as const) {
      await caller.caseAssignments.updateMemberStage({ memberId, stage });
    }

    const rows = await query<{ stage: string }>(
      "SELECT stage FROM case_assignment_workers WHERE id = ?",
      [memberId]
    );
    expect(rows[0].stage).toBe("employed");
    expect(
      (await caller.caseQualifications.getById({ id: qualificationId }))
        .quotaRemaining
    ).toBe(0);
  });

  it("退回 departed 後額度會釋放回來", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);
    const { id: qualificationId } = await caller.caseQualifications.create({
      caseId,
      ...qualInput({ quotaTotal: 1 }),
    });
    const { memberId } = await makeMemberAtStage(caller, {
      caseId,
      workerId,
      stage: "employed",
      qualificationId,
    });

    await caller.caseAssignments.updateMemberStage({
      memberId,
      stage: "departed",
    });

    expect(
      (await caller.caseQualifications.getById({ id: qualificationId }))
        .quotaUsed
    ).toBe(0);
  });

  it("拒絕不存在的階段名稱", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);
    const { memberId } = await makeMemberAtStage(caller, {
      caseId,
      workerId,
      stage: "candidate",
    });

    await expect(
      caller.caseAssignments.updateMemberStage({
        memberId,
        stage: "unknown" as "candidate",
      })
    ).rejects.toThrow();
  });
});

describe("caseAssignments.removeWorker", () => {
  it("只刪掉指定成員，配對與其他成員保留", async () => {
    const caller = createCaller();
    const { caseId, managerId, workerId } = await makeCaseWorld(caller);
    const w2 = await makeWorker(caller, managerId, { name: "移工乙" });
    const { assignmentId } = await caller.caseAssignments.create({
      caseId,
      workerIds: [workerId, w2],
    });
    const members = await caller.caseAssignments.getMembersByCaseId({ caseId });

    await caller.caseAssignments.removeWorker({ memberId: members[0].id });

    const remaining = await query<{ workerId: number }>(
      "SELECT workerId FROM case_assignment_workers WHERE assignmentId = ?",
      [assignmentId]
    );
    expect(remaining.map(m => m.workerId)).toEqual([w2]);
    expect(
      await query("SELECT id FROM case_assignments WHERE id = ?", [
        assignmentId,
      ])
    ).toHaveLength(1);
  });

  it("移除後該移工可重新配對（釋放唯一性佔位）", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);
    await caller.caseAssignments.create({ caseId, workerIds: [workerId] });
    const [member] = await caller.caseAssignments.getMembersByCaseId({
      caseId,
    });

    await caller.caseAssignments.removeWorker({ memberId: member.id });

    await expect(
      caller.caseAssignments.create({ caseId, workerIds: [workerId] })
    ).resolves.toMatchObject({ success: true });
  });
});

describe("caseAssignments.delete", () => {
  it("刪除配對後成員不留孤兒", async () => {
    const caller = createCaller();
    const { caseId, managerId, workerId } = await makeCaseWorld(caller);
    const w2 = await makeWorker(caller, managerId, { name: "移工乙" });
    const { assignmentId } = await caller.caseAssignments.create({
      caseId,
      workerIds: [workerId, w2],
    });

    await caller.caseAssignments.delete({ id: assignmentId });

    expect(
      await query(
        "SELECT id FROM case_assignment_workers WHERE assignmentId = ?",
        [assignmentId]
      )
    ).toHaveLength(0);
    expect(
      await query("SELECT id FROM case_assignments WHERE id = ?", [
        assignmentId,
      ])
    ).toHaveLength(0);
  });

  it("不會誤刪同案件其他配對的成員", async () => {
    const caller = createCaller();
    const { caseId, managerId, workerId } = await makeCaseWorld(caller);
    const w2 = await makeWorker(caller, managerId, { name: "移工乙" });
    const first = await caller.caseAssignments.create({
      caseId,
      workerIds: [workerId],
    });
    await caller.caseAssignments.create({ caseId, workerIds: [w2] });

    await caller.caseAssignments.delete({ id: first.assignmentId });

    const rest = await caller.caseAssignments.getMembersByCaseId({ caseId });
    expect(rest.map(m => m.workerId)).toEqual([w2]);
  });
});

describe("caseAssignments.workerInvolvements", () => {
  it("只列出進行中階段的參與", async () => {
    const caller = createCaller();
    const { caseId, managerId, workerId } = await makeCaseWorld(caller);
    const w2 = await makeWorker(caller, managerId, { name: "移工乙" });
    await makeMemberAtStage(caller, { caseId, workerId, stage: "confirmed" });
    await makeMemberAtStage(caller, {
      caseId,
      workerId: w2,
      stage: "departed",
    });

    const result = await caller.caseAssignments.workerInvolvements({});

    expect(result).toHaveLength(1);
    expect(result[0].workerId).toBe(workerId);
    expect(result[0].stage).toBe("confirmed");
  });

  it("帶出案件與雇主名稱，供跨案件提醒使用", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);
    await caller.caseAssignments.create({ caseId, workerIds: [workerId] });

    const [row] = await caller.caseAssignments.workerInvolvements({});

    expect(row).toMatchObject({
      caseId,
      caseName: "測試案件",
      customerName: "測試雇主股份有限公司",
      workerName: "測試移工",
    });
  });

  it("excludeCaseId 會排除目前正在看的案件", async () => {
    const caller = createCaller();
    const { caseId, customerId, managerId, workerId } =
      await makeCaseWorld(caller);
    const otherCaseId = await makeCase(caller, customerId, managerId, {
      name: "他案",
    });
    await caller.caseAssignments.create({ caseId, workerIds: [workerId] });
    await caller.caseAssignments.create({
      caseId: otherCaseId,
      workerIds: [workerId],
    });

    const result = await caller.caseAssignments.workerInvolvements({
      excludeCaseId: caseId,
    });

    expect(result).toHaveLength(1);
    expect(result[0].caseId).toBe(otherCaseId);
  });
});

describe("caseAssignments.getMembersByCaseId", () => {
  it("跨配對彙整同案件的所有成員，且不含別的案件", async () => {
    const caller = createCaller();
    const { caseId, customerId, managerId, workerId } =
      await makeCaseWorld(caller);
    const w2 = await makeWorker(caller, managerId, { nameCn: "移工乙" });
    const w3 = await makeWorker(caller, managerId, { nameCn: "移工丙" });
    const otherCaseId = await makeCase(caller, customerId, managerId, {
      name: "他案",
    });

    await caller.caseAssignments.create({ caseId, workerIds: [workerId, w2] });
    await caller.caseAssignments.create({
      caseId: otherCaseId,
      workerIds: [w3],
    });

    const result = await caller.caseAssignments.getMembersByCaseId({ caseId });

    expect(result.map(m => m.workerId)).toEqual([workerId, w2]);
    expect(result[1].workerName).toBe("移工乙");
  });
});

// ─── caseEmployments ────────────────────────────────────────────────────────

describe("caseEmployments.create", () => {
  it("實際寫入資料庫，未填的可選欄位為 NULL", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);

    const result = await caller.caseEmployments.create({
      caseId,
      workerId,
      position: "家庭看護工",
      contractStart: "2026-08-01",
      contractEnd: "2029-07-31",
      status: "active",
    });

    expect(result).toMatchObject({ success: true });
    const rows = await query<{
      caseId: number;
      workerId: number;
      position: string;
      contractStart: string;
      contractEnd: string;
      status: string;
      qualificationId: number | null;
      terminationReason: string | null;
    }>("SELECT * FROM case_employments WHERE id = ?", [result.id]);
    expect(rows[0]).toMatchObject({
      caseId,
      workerId,
      position: "家庭看護工",
      contractStart: "2026-08-01",
      contractEnd: "2029-07-31",
      status: "active",
    });
    expect(rows[0].qualificationId).toBeNull();
    expect(rows[0].terminationReason).toBeNull();
  });

  it("未指定狀態時預設為 pending", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);

    const { id } = await caller.caseEmployments.create({ caseId, workerId });

    const rows = await query<{ status: string }>(
      "SELECT status FROM case_employments WHERE id = ?",
      [id]
    );
    expect(rows[0].status).toBe("pending");
  });

  it("拒絕不合法的狀態，且不留下半筆資料", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);

    await expect(
      caller.caseEmployments.create({
        caseId,
        workerId,
        status: "unknown" as "active",
      })
    ).rejects.toThrow();

    expect(await query("SELECT id FROM case_employments")).toHaveLength(0);
  });
});

describe("caseEmployments.listByCase", () => {
  it("帶出移工姓名與所屬資格標籤", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);
    const { id: qualificationId } = await caller.caseQualifications.create({
      caseId,
      ...qualInput({ label: "看護資格甲" }),
    });
    await caller.caseEmployments.create({ caseId, workerId, qualificationId });

    const [row] = await caller.caseEmployments.listByCase({ caseId });

    expect(row.workerName).toBe("測試移工");
    expect(row.qualificationLabel).toBe("看護資格甲");
  });

  it("沒綁資格時 qualificationLabel 為空字串", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);
    await caller.caseEmployments.create({ caseId, workerId });

    const [row] = await caller.caseEmployments.listByCase({ caseId });
    expect(row.qualificationLabel).toBe("");
  });

  it("不會撈到別的案件的聘僱紀錄", async () => {
    const caller = createCaller();
    const { caseId, customerId, managerId, workerId } =
      await makeCaseWorld(caller);
    const otherCaseId = await makeCase(caller, customerId, managerId, {
      name: "他案",
    });
    await caller.caseEmployments.create({ caseId: otherCaseId, workerId });

    await expect(
      caller.caseEmployments.listByCase({ caseId })
    ).resolves.toEqual([]);
  });
});

describe("caseEmployments.update", () => {
  it("更新狀態與終止原因真的寫回資料庫", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);
    const { id } = await caller.caseEmployments.create({
      caseId,
      workerId,
      status: "active",
    });

    await caller.caseEmployments.update({
      id,
      status: "terminated",
      terminationReason: "雇主提前解約",
      position: "家庭看護工",
    });

    const rows = await query<{ status: string; terminationReason: string }>(
      "SELECT status, terminationReason FROM case_employments WHERE id = ?",
      [id]
    );
    expect(rows[0]).toMatchObject({
      status: "terminated",
      terminationReason: "雇主提前解約",
    });
  });

  it("未傳入的可選欄位會被清成 NULL（整筆覆蓋語意，非部分更新）", async () => {
    const caller = createCaller();
    const { caseId, workerId } = await makeCaseWorld(caller);
    const { id } = await caller.caseEmployments.create({
      caseId,
      workerId,
      position: "家庭看護工",
      contractStart: "2026-08-01",
      status: "active",
    });

    // 只想改狀態，但 router 會把沒帶的欄位一律寫成 null —— 前端必須整份送出。
    await caller.caseEmployments.update({ id, status: "expired" });

    const rows = await query<{
      status: string;
      position: string | null;
      contractStart: string | null;
    }>(
      "SELECT status, position, contractStart FROM case_employments WHERE id = ?",
      [id]
    );
    expect(rows[0].status).toBe("expired");
    expect(rows[0].position).toBeNull();
    expect(rows[0].contractStart).toBeNull();
  });
});

describe("caseEmployments.delete", () => {
  it("刪除後資料庫查不到，其他案件的紀錄不受影響", async () => {
    const caller = createCaller();
    const { caseId, customerId, managerId, workerId } =
      await makeCaseWorld(caller);
    const otherCaseId = await makeCase(caller, customerId, managerId, {
      name: "他案",
    });
    const { id } = await caller.caseEmployments.create({ caseId, workerId });
    await caller.caseEmployments.create({ caseId: otherCaseId, workerId });

    await caller.caseEmployments.delete({ id });

    expect(
      await query("SELECT id FROM case_employments WHERE id = ?", [id])
    ).toHaveLength(0);
    expect(
      await caller.caseEmployments.listByCase({ caseId: otherCaseId })
    ).toHaveLength(1);
  });
});
