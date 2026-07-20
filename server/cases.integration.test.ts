/**
 * cases router 的整合測試 —— 打真實 MySQL，不 mock db。
 *
 * 這裡刻意驗證幾件 mock 測試驗不到的事：
 *   - 真實 SQL 是否寫得進去、讀得回來（欄位對映、型別轉換）
 *   - 驗證失敗時是否真的沒有留下半筆資料
 *   - getChildCounts 的計數是否與子表實際筆數一致
 */
import { describe, expect, it } from "vitest";
import { createCaller } from "./__tests__/helpers/caller";
import {
  demandInput,
  makeCase,
  makeCaseWorld,
  makeCustomer,
  makeManager,
  makeWorker,
} from "./__tests__/helpers/fixtures";
import { query } from "./__tests__/helpers/testDb";

describe("cases.create", () => {
  it("實際寫入資料庫並可讀回", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId);

    const caseId = await makeCase(caller, customerId, managerId, {
      name: "王小明看護案",
    });

    const rows = await query<{ id: number; name: string; status: string }>(
      "SELECT id, name, status FROM `cases` WHERE id = ?",
      [caseId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("王小明看護案");
    expect(rows[0].status).toBe("in_progress");
  });

  it("產生的 caseNo 符合 GVC25-YYYYMMDD-NNN 格式", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId);

    const result = await caller.cases.create({
      customerId,
      managerId,
      name: "編號格式測試案",
      status: "in_progress",
    } as Parameters<typeof caller.cases.create>[0]);

    expect(result.caseNo).toMatch(/^GVC25-\d{8}-\d{3}$/);
  });

  it("拒絕過短的案件名稱，且不留下半筆資料", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId);

    await expect(
      makeCase(caller, customerId, managerId, { name: "短" })
    ).rejects.toThrow();

    const rows = await query("SELECT id FROM `cases`");
    expect(rows).toHaveLength(0);
  });
});

describe("cases.getById", () => {
  it("帶出雇主與負責人資料", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller, "陳專員");
    const customerId = await makeCustomer(caller, managerId, {
      name: "長青照護有限公司",
      phone: "0223456789",
    });
    const caseId = await makeCase(caller, customerId, managerId);

    const result = await caller.cases.getById({ id: caseId });

    expect(result.customerName).toBe("長青照護有限公司");
    expect(result.managerName).toBe("陳專員");
    expect(result.customerPhone).toBe("0223456789");
  });

  it("查無資料時拋出 NOT_FOUND", async () => {
    const caller = createCaller();
    await expect(caller.cases.getById({ id: 999999 })).rejects.toThrow(
      /找不到/
    );
  });
});

describe("cases.list", () => {
  it("依 customerId 過濾", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerA = await makeCustomer(caller, managerId, {
      name: "甲雇主有限公司",
    });
    const customerB = await makeCustomer(caller, managerId, {
      name: "乙雇主有限公司",
    });

    await makeCase(caller, customerA, managerId, { name: "甲案件一" });
    await makeCase(caller, customerA, managerId, { name: "甲案件二" });
    await makeCase(caller, customerB, managerId, { name: "乙案件一" });

    const result = await caller.cases.list({ customerId: customerA });

    expect(result).toHaveLength(2);
    expect(result.every(c => c.customerId === customerA)).toBe(true);
  });

  it("orderBy name 依 zh-TW 筆畫排序", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId);

    // zh-TW 的 localeCompare 是「依筆畫數」排序，不是注音也不是 Unicode 碼位。
    // 王(4畫) < 李(7畫) < 張(11畫)。
    await makeCase(caller, customerId, managerId, { name: "張先生案" });
    await makeCase(caller, customerId, managerId, { name: "王小姐案" });
    await makeCase(caller, customerId, managerId, { name: "李先生案" });

    const result = await caller.cases.list({ orderBy: "name" });

    expect(result.map(c => c.name)).toEqual([
      "王小姐案",
      "李先生案",
      "張先生案",
    ]);
  });

  it("list 會帶出子表維度計數（驗證批次查詢正確性）", async () => {
    const caller = createCaller();
    const { caseId } = await makeCaseWorld(caller);
    await caller.caseDemands.create({ caseId, ...demandInput() });

    const result = await caller.cases.list({});

    const target = result.find(c => c.id === caseId);
    expect(target?.demandCount).toBe(1);
  });

  it("空資料庫回傳空陣列而非報錯", async () => {
    const caller = createCaller();
    await expect(caller.cases.list({})).resolves.toEqual([]);
  });
});

describe("cases.getChildCounts", () => {
  it("計數與子表實際筆數一致", async () => {
    const caller = createCaller();
    const { caseId } = await makeCaseWorld(caller);

    await caller.caseDemands.create({
      caseId,
      ...demandInput({ label: "需求一" }),
    });
    await caller.caseDemands.create({
      caseId,
      ...demandInput({ label: "需求二" }),
    });

    const counts = await caller.cases.getChildCounts({ id: caseId });
    const actual = await query<{ n: number }>(
      "SELECT COUNT(*) AS n FROM case_demands WHERE caseId = ?",
      [caseId]
    );

    expect(Number(actual[0].n)).toBe(2);
    expect(counts.demandCount).toBe(2);
  });

  it("跨多個配對批次正確加總成員數", async () => {
    const caller = createCaller();
    const { caseId, managerId } = await makeCaseWorld(caller);

    // 兩個配對批次、共三位移工 —— 這正是原本 N+1 迴圈在處理的情境，
    // 改成單次 join 查詢後結果必須完全一樣。
    const w1 = await makeWorker(caller, managerId, { name: "移工一" });
    const w2 = await makeWorker(caller, managerId, { name: "移工二" });
    const w3 = await makeWorker(caller, managerId, { name: "移工三" });

    await caller.caseAssignments.create({ caseId, workerIds: [w1, w2] });
    await caller.caseAssignments.create({ caseId, workerIds: [w3] });

    const counts = await caller.cases.getChildCounts({ id: caseId });

    expect(counts.assignmentCount).toBe(2);
    expect(counts.memberCount).toBe(3);
  });

  it("沒有任何子表資料時全部回 0", async () => {
    const caller = createCaller();
    const { caseId } = await makeCaseWorld(caller);

    expect(await caller.cases.getChildCounts({ id: caseId })).toEqual({
      qualCount: 0,
      demandCount: 0,
      assignmentCount: 0,
      memberCount: 0,
    });
  });

  it("不會把別的案件的子表算進來", async () => {
    const caller = createCaller();
    const { caseId, customerId, managerId } = await makeCaseWorld(caller);
    const otherCaseId = await makeCase(caller, customerId, managerId, {
      name: "另一個案件",
    });

    await caller.caseDemands.create({ caseId, ...demandInput() });

    expect(
      (await caller.cases.getChildCounts({ id: otherCaseId })).demandCount
    ).toBe(0);
  });
});

describe("cases.delete", () => {
  it("刪除案件後子表資料不殘留", async () => {
    const caller = createCaller();
    const { caseId } = await makeCaseWorld(caller);
    await caller.caseDemands.create({ caseId, ...demandInput() });

    await caller.cases.delete({ id: caseId });

    const orphans = await query(
      "SELECT id FROM case_demands WHERE caseId = ?",
      [caseId]
    );
    expect(orphans).toHaveLength(0);
  });
});
