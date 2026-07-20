/**
 * customers router 的整合測試 —— 打真實 MySQL，不 mock db。
 *
 * 這裡刻意驗證幾件 mock 測試驗不到的事：
 *   - 真實 SQL 是否寫得進去、讀得回來（欄位對映、電話正規化）
 *   - 驗證失敗（統編檢查碼、同名查重）時是否真的沒有留下半筆資料
 *   - 子表（被照顧者、申請資格）是否確實依 customerId 隔離
 *   - 刪除雇主後子表的實際殘留狀況
 */
import { describe, expect, it } from "vitest";
import { createCaller } from "./__tests__/helpers/caller";
import { makeCustomer, makeManager } from "./__tests__/helpers/fixtures";
import { query } from "./__tests__/helpers/testDb";

/** 通過檢查碼驗證的合法統一編號。隨便編的號碼會被 validateTaxId 擋掉。 */
const VALID_TAX_ID = "12345675";

describe("customers.create", () => {
  it("實際寫入資料庫並可讀回", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);

    const customerId = await makeCustomer(caller, managerId, {
      name: "長青照護有限公司",
      employerType: "company",
      contractStatus: "in_service",
    });

    const rows = await query<{
      id: number;
      name: string;
      employerType: string;
      contractStatus: string;
      managerId: number;
    }>(
      "SELECT id, name, employerType, contractStatus, managerId FROM customers WHERE id = ?",
      [customerId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("長青照護有限公司");
    expect(rows[0].employerType).toBe("company");
    expect(rows[0].contractStatus).toBe("in_service");
    expect(rows[0].managerId).toBe(managerId);
  });

  it("回傳的 id 指向剛建立的那一筆（前端可據此導向詳情頁）", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);

    // 先建一筆干擾資料，確保回傳的不是「最後一筆」這種巧合
    await makeCustomer(caller, managerId, { name: "先建立的雇主" });

    const result = await caller.customers.create({
      employerType: "company",
      name: "要導向的雇主",
      contractStatus: "signed",
      pricingTier: "standard",
      managerId,
    } as Parameters<typeof caller.customers.create>[0]);

    expect(result.success).toBe(true);
    expect(result.id).toBeGreaterThan(0);
    expect((await caller.customers.getById({ id: result.id })).name).toBe(
      "要導向的雇主"
    );
  });

  it("電話與市話寫入前會去掉連字號", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);

    const customerId = await makeCustomer(caller, managerId, {
      name: "電話正規化測試公司",
      phone: "0912-345-678",
      landline: "02-2345-6789",
      contactPhone: "03-456-7890",
    });

    const customer = await caller.customers.getById({ id: customerId });
    expect(customer.phone).toBe("0912345678");
    expect(customer.landline).toBe("0223456789");
    expect(customer.contactPhone).toBe("034567890");
  });

  it("拒絕檢查碼不合法的統一編號，且不留下半筆資料", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);

    await expect(
      makeCustomer(caller, managerId, {
        name: "統編錯誤公司",
        taxId: "12345678",
      })
    ).rejects.toThrow(/統一編號格式不正確/);

    expect(await query("SELECT id FROM customers")).toHaveLength(0);
  });

  it("拒絕過短的名稱，且不留下半筆資料", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);

    await expect(
      makeCustomer(caller, managerId, { name: "甲" })
    ).rejects.toThrow();

    expect(await query("SELECT id FROM customers")).toHaveLength(0);
  });

  it("拒絕格式錯誤的聯絡窗口電話", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);

    await expect(
      makeCustomer(caller, managerId, {
        name: "窗口電話錯誤公司",
        contactPhone: "123",
      })
    ).rejects.toThrow(/聯絡窗口電話格式不正確/);

    expect(await query("SELECT id FROM customers")).toHaveLength(0);
  });

  it("同一統編不可重複建檔", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeCustomer(caller, managerId, {
      name: "甲公司",
      taxId: VALID_TAX_ID,
    });

    await expect(
      makeCustomer(caller, managerId, {
        name: "乙公司",
        taxId: VALID_TAX_ID,
      })
    ).rejects.toThrow(/統一編號已存在/);

    expect(await query("SELECT id FROM customers")).toHaveLength(1);
  });

  it("同名雇主會被擋下，訊息帶 DUPLICATE_NAME 前綴供前端跳確認視窗", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeCustomer(caller, managerId, { name: "重複名稱有限公司" });

    await expect(
      makeCustomer(caller, managerId, { name: "重複名稱有限公司" })
    ).rejects.toThrow(/DUPLICATE_NAME:/);
  });

  it("forceCreate 可略過同名檢查，兩筆同名資料都真的存在", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeCustomer(caller, managerId, { name: "同名照護有限公司" });

    await makeCustomer(caller, managerId, {
      name: "同名照護有限公司",
      forceCreate: true,
    });

    const rows = await query("SELECT id FROM customers WHERE name = ?", [
      "同名照護有限公司",
    ]);
    expect(rows).toHaveLength(2);
  });
});

describe("customers.getById", () => {
  it("查無資料時拋出 NOT_FOUND", async () => {
    const caller = createCaller();
    await expect(caller.customers.getById({ id: 999999 })).rejects.toThrow(
      /找不到/
    );
  });
});

describe("customers.list", () => {
  it("列出所有雇主", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeCustomer(caller, managerId, { name: "王記工程行" });
    await makeCustomer(caller, managerId, { name: "李氏照護有限公司" });
    await makeCustomer(caller, managerId, { name: "張家企業社" });

    const result = await caller.customers.list();

    expect(result).toHaveLength(3);
    expect(new Set(result.map(c => c.name))).toEqual(
      new Set(["王記工程行", "李氏照護有限公司", "張家企業社"])
    );
  });

  it("空資料庫回傳空陣列而非報錯", async () => {
    const caller = createCaller();
    await expect(caller.customers.list()).resolves.toEqual([]);
  });
});

describe("customers.update", () => {
  it("實際更新資料庫欄位", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId, {
      name: "更新前公司",
      contractStatus: "negotiating",
    });

    await caller.customers.update({
      id: customerId,
      employerType: "company",
      name: "更新後公司",
      contractStatus: "in_service",
      pricingTier: "custom",
      managerId,
    } as Parameters<typeof caller.customers.update>[0]);

    const rows = await query<{ name: string; contractStatus: string }>(
      "SELECT name, contractStatus FROM customers WHERE id = ?",
      [customerId]
    );
    expect(rows[0].name).toBe("更新後公司");
    expect(rows[0].contractStatus).toBe("in_service");
  });

  it("沿用自己原本的統編不會被誤判為重複", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId, {
      name: "統編沿用公司",
      taxId: VALID_TAX_ID,
    });

    await caller.customers.update({
      id: customerId,
      employerType: "company",
      name: "統編沿用公司（改名）",
      taxId: VALID_TAX_ID,
      contractStatus: "signed",
      pricingTier: "standard",
      managerId,
    } as Parameters<typeof caller.customers.update>[0]);

    const customer = await caller.customers.getById({ id: customerId });
    expect(customer.name).toBe("統編沿用公司（改名）");
    expect(customer.taxId).toBe(VALID_TAX_ID);
  });

  it("不可改成別人已在用的統編，且原資料保持不變", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeCustomer(caller, managerId, {
      name: "已佔用統編公司",
      taxId: VALID_TAX_ID,
    });
    const customerId = await makeCustomer(caller, managerId, {
      name: "想搶統編公司",
    });

    await expect(
      caller.customers.update({
        id: customerId,
        employerType: "company",
        name: "想搶統編公司",
        taxId: VALID_TAX_ID,
        contractStatus: "signed",
        pricingTier: "standard",
        managerId,
      } as Parameters<typeof caller.customers.update>[0])
    ).rejects.toThrow(/統一編號已存在/);

    expect(
      (await caller.customers.getById({ id: customerId })).taxId
    ).toBeNull();
  });
});

describe("customers.delete", () => {
  it("刪除後資料庫真的查不到", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId, {
      name: "待刪除公司",
    });

    await caller.customers.delete({ id: customerId });

    expect(
      await query("SELECT id FROM customers WHERE id = ?", [customerId])
    ).toHaveLength(0);
    await expect(caller.customers.getById({ id: customerId })).rejects.toThrow(
      /找不到/
    );
  });

  it("不會誤刪其他雇主", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const target = await makeCustomer(caller, managerId, {
      name: "要刪的公司",
    });
    const survivor = await makeCustomer(caller, managerId, {
      name: "要留的公司",
    });

    await caller.customers.delete({ id: target });

    expect(await caller.customers.list()).toHaveLength(1);
    expect((await caller.customers.getById({ id: survivor })).name).toBe(
      "要留的公司"
    );
  });

  it("刪除雇主後子表資料會變成孤兒（記錄現況，非期望行為）", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId, {
      name: "有子表的公司",
    });
    await caller.customers.careReceivers.create({
      customerId,
      careReceiverName: "陳阿嬤",
    });
    await caller.customers.qualifications.create({
      customerId,
      label: "家庭看護資格",
    });

    await caller.customers.delete({ id: customerId });

    // customer_care_receivers / customer_qualifications 都沒有 FK 也沒有
    // 應用層的連動刪除，因此子表會殘留孤兒列。詳見最終報告的問題清單。
    expect(
      await query(
        "SELECT id FROM customer_care_receivers WHERE customerId = ?",
        [customerId]
      )
    ).toHaveLength(1);
    expect(
      await query(
        "SELECT id FROM customer_qualifications WHERE customerId = ?",
        [customerId]
      )
    ).toHaveLength(1);
  });
});

describe("customers.careReceivers", () => {
  it("建立後實際寫入資料庫並可讀回", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId);

    const { id } = await caller.customers.careReceivers.create({
      customerId,
      careReceiverName: "林奶奶",
      careReceiverNo: "CR-001",
      careReceiverRelation: "祖母",
      careReceiverBirthDate: "1940-03-05",
    });

    const rows = await query<{
      customerId: number;
      careReceiverName: string;
      careReceiverRelation: string;
    }>(
      "SELECT customerId, careReceiverName, careReceiverRelation FROM customer_care_receivers WHERE id = ?",
      [id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].customerId).toBe(customerId);
    expect(rows[0].careReceiverName).toBe("林奶奶");
    expect(rows[0].careReceiverRelation).toBe("祖母");
  });

  it("listByCustomer 只回傳該雇主的被照顧者", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerA = await makeCustomer(caller, managerId, {
      name: "甲雇主有限公司",
    });
    const customerB = await makeCustomer(caller, managerId, {
      name: "乙雇主有限公司",
    });

    await caller.customers.careReceivers.create({
      customerId: customerA,
      careReceiverName: "甲家阿公",
    });
    await caller.customers.careReceivers.create({
      customerId: customerA,
      careReceiverName: "甲家阿嬤",
    });
    await caller.customers.careReceivers.create({
      customerId: customerB,
      careReceiverName: "乙家阿嬤",
    });

    const listA = await caller.customers.careReceivers.listByCustomer({
      customerId: customerA,
    });

    expect(listA).toHaveLength(2);
    expect(listA.every(r => r.customerId === customerA)).toBe(true);
    expect(listA.map(r => r.careReceiverName)).not.toContain("乙家阿嬤");
  });

  it("沒有被照顧者時回傳空陣列", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId);

    await expect(
      caller.customers.careReceivers.listByCustomer({ customerId })
    ).resolves.toEqual([]);
  });

  it("update 只改到指定那一筆", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId);
    const { id: targetId } = await caller.customers.careReceivers.create({
      customerId,
      careReceiverName: "原本的名字",
      careReceiverRelation: "父",
    });
    const { id: otherId } = await caller.customers.careReceivers.create({
      customerId,
      careReceiverName: "不該被動到的名字",
    });

    await caller.customers.careReceivers.update({
      id: targetId,
      careReceiverName: "改過的名字",
      careReceiverAddress: "台北市中正區忠孝東路一段1號",
    });

    const rows = await query<{ id: number; careReceiverName: string }>(
      "SELECT id, careReceiverName FROM customer_care_receivers ORDER BY id"
    );
    expect(rows.find(r => r.id === targetId)?.careReceiverName).toBe(
      "改過的名字"
    );
    expect(rows.find(r => r.id === otherId)?.careReceiverName).toBe(
      "不該被動到的名字"
    );
  });

  it("delete 後資料庫不留該筆，其他筆不受影響", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId);
    const { id: targetId } = await caller.customers.careReceivers.create({
      customerId,
      careReceiverName: "要刪的被照顧者",
    });
    await caller.customers.careReceivers.create({
      customerId,
      careReceiverName: "要留的被照顧者",
    });

    await caller.customers.careReceivers.delete({ id: targetId });

    const remaining = await caller.customers.careReceivers.listByCustomer({
      customerId,
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].careReceiverName).toBe("要留的被照顧者");
  });
});

describe("customers.qualifications", () => {
  it("建立後實際寫入資料庫，qualifierCategory 預設為 family", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId);

    const { id } = await caller.customers.qualifications.create({
      customerId,
      label: "家庭看護工申請",
      jobSeekerType: "new_hire",
      recruitmentPermitDays: 60,
    });

    const rows = await query<{
      customerId: number;
      qualifierCategory: string;
      label: string;
      jobSeekerType: string;
      recruitmentPermitDays: number;
    }>(
      "SELECT customerId, qualifierCategory, label, jobSeekerType, recruitmentPermitDays FROM customer_qualifications WHERE id = ?",
      [id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].customerId).toBe(customerId);
    expect(rows[0].qualifierCategory).toBe("family");
    expect(rows[0].label).toBe("家庭看護工申請");
    expect(rows[0].jobSeekerType).toBe("new_hire");
    expect(rows[0].recruitmentPermitDays).toBe(60);
  });

  it("可掛到指定的被照顧者上", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId);
    const { id: careReceiverId } = await caller.customers.careReceivers.create({
      customerId,
      careReceiverName: "黃阿公",
    });

    const { id } = await caller.customers.qualifications.create({
      customerId,
      careReceiverId,
      qualifierCategory: "family",
      label: "黃阿公的看護資格",
    });

    const list = await caller.customers.qualifications.listByCustomer({
      customerId,
    });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(id);
    expect(list[0].careReceiverId).toBe(careReceiverId);
  });

  it("listByCustomer 只回傳該雇主的資格", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerA = await makeCustomer(caller, managerId, {
      name: "甲雇主有限公司",
    });
    const customerB = await makeCustomer(caller, managerId, {
      name: "乙雇主有限公司",
    });

    await caller.customers.qualifications.create({
      customerId: customerA,
      label: "甲資格一",
    });
    await caller.customers.qualifications.create({
      customerId: customerA,
      label: "甲資格二",
    });
    await caller.customers.qualifications.create({
      customerId: customerB,
      label: "乙資格一",
    });

    const listB = await caller.customers.qualifications.listByCustomer({
      customerId: customerB,
    });

    expect(listB).toHaveLength(1);
    expect(listB[0].label).toBe("乙資格一");
  });

  it("update 寫入的值可從資料庫讀回", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId);
    const { id } = await caller.customers.qualifications.create({
      customerId,
      label: "更新前資格",
      caseStatus: "pending",
    });

    await caller.customers.qualifications.update({
      id,
      label: "更新後資格",
      caseStatus: "matched",
      qualifierCategory: "business",
      approvedStartDate: "2026-01-01",
      approvedEndDate: "2029-01-01",
    });

    const rows = await query<{
      label: string;
      caseStatus: string;
      qualifierCategory: string;
      approvedEndDate: string;
    }>(
      "SELECT label, caseStatus, qualifierCategory, approvedEndDate FROM customer_qualifications WHERE id = ?",
      [id]
    );
    expect(rows[0].label).toBe("更新後資格");
    expect(rows[0].caseStatus).toBe("matched");
    expect(rows[0].qualifierCategory).toBe("business");
    expect(rows[0].approvedEndDate).toBe("2029-01-01");
  });

  it("delete 後資料庫不留該筆", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId);
    const { id } = await caller.customers.qualifications.create({
      customerId,
      label: "要刪的資格",
    });

    await caller.customers.qualifications.delete({ id });

    expect(
      await query("SELECT id FROM customer_qualifications WHERE id = ?", [id])
    ).toHaveLength(0);
  });

  it("刪除某雇主的資格不會影響另一雇主的資格", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerA = await makeCustomer(caller, managerId, {
      name: "甲雇主有限公司",
    });
    const customerB = await makeCustomer(caller, managerId, {
      name: "乙雇主有限公司",
    });
    const { id: qualA } = await caller.customers.qualifications.create({
      customerId: customerA,
      label: "甲資格",
    });
    await caller.customers.qualifications.create({
      customerId: customerB,
      label: "乙資格",
    });

    await caller.customers.qualifications.delete({ id: qualA });

    expect(
      await caller.customers.qualifications.listByCustomer({
        customerId: customerB,
      })
    ).toHaveLength(1);
  });
});
