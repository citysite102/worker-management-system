/**
 * workers / managers router 與 dashboard.summary 的整合測試 —— 打真實 MySQL，不 mock db。
 *
 * 這裡刻意驗證幾件 mock 測試驗不到的事：
 *   - 證件唯一性檢查是真的去查資料表，而不是只看記憶體
 *   - 驗證失敗時是否真的沒有留下半筆資料
 *   - dashboard.summary 的計數是否與資料表實際內容一致
 *   - 「到期」是以人數計、且與 kpi_snapshots 的趨勢比較如何互動
 */
import { describe, expect, it } from "vitest";
import { createCaller } from "./__tests__/helpers/caller";
import {
  makeCase,
  makeCustomer,
  makeManager,
  makeWorker,
} from "./__tests__/helpers/fixtures";
import { query } from "./__tests__/helpers/testDb";

const DAY_MS = 86400000;

/** 以台北時區取得今天的 YYYY-MM-DD —— 與 dashboard.summary 的日期基準一致。 */
function taipeiToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * 相對於「今天」的日期字串（正數=未來，負數=過去）。
 * 證件到期相關的測試一律用這個算，硬編絕對日期會隨時間腐壞。
 */
function dayOffset(days: number): string {
  return new Date(Date.parse(taipeiToday() + "T00:00:00Z") + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** 一位「在職且文件完備」的移工 —— 用來湊 dashboard 的 employed 計數。 */
const EMPLOYED = {
  lifecycleStatus: "employed",
  documentStatus: "complete",
} as const;

describe("managers.create / list / delete", () => {
  it("建立後可從 list 讀回，且回傳 { success, id }", async () => {
    const caller = createCaller();

    const result = await caller.managers.create({ name: "陳專員" });

    expect(result.success).toBe(true);
    expect(result.id).toBeGreaterThan(0);
    const list = await caller.managers.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: result.id, name: "陳專員" });
  });

  it("名稱前後空白會被去除", async () => {
    const caller = createCaller();
    const id = await (await caller.managers.create({ name: "  林專員  " })).id;

    const rows = await query<{ name: string }>(
      "SELECT name FROM managers WHERE id = ?",
      [id]
    );
    expect(rows[0].name).toBe("林專員");
  });

  it("拒絕空白名稱，且不留下半筆資料", async () => {
    const caller = createCaller();

    await expect(caller.managers.create({ name: "" })).rejects.toThrow();

    expect(await query("SELECT id FROM managers")).toHaveLength(0);
  });

  it("list 依 id 遞增排序", async () => {
    const caller = createCaller();
    // 刻意用筆畫在前的名字後建，確認排序看的是 id 不是名稱
    const first = await makeManager(caller, "張專員");
    const second = await makeManager(caller, "王專員");

    const list = await caller.managers.list();

    expect(list.map(m => m.id)).toEqual([first, second]);
  });

  it("delete 真的把該筆從資料表移除", async () => {
    const caller = createCaller();
    const id = await makeManager(caller);

    await caller.managers.delete({ id });

    expect(await query("SELECT id FROM managers WHERE id = ?", [id])).toEqual(
      []
    );
  });

  it("空資料庫回傳空陣列而非報錯", async () => {
    const caller = createCaller();
    await expect(caller.managers.list()).resolves.toEqual([]);
  });
});

describe("workers.create", () => {
  it("實際寫入資料庫並可讀回", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);

    const workerId = await makeWorker(caller, managerId, {
      name: "SITI AMINAH",
      nameEn: "SITI AMINAH",
      nameCn: "施蒂",
      nationality: "009 印尼",
      residentPermitNo: "A123456789",
    });

    const rows = await query<{
      name: string;
      nameCn: string;
      lifecycleStatus: string;
      residentPermitNo: string;
    }>(
      "SELECT name, nameCn, lifecycleStatus, residentPermitNo FROM workers WHERE id = ?",
      [workerId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].nameCn).toBe("施蒂");
    expect(rows[0].lifecycleStatus).toBe("idle_in_tw");
    expect(rows[0].residentPermitNo).toBe("A123456789");
  });

  it("顯示用 name 以 nameCn 優先，其次 nameEn，最後才是 name", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);

    const withCn = await makeWorker(caller, managerId, {
      name: "原始姓名",
      nameEn: "BUDI SANTOSO",
      nameCn: "布迪",
    });
    const withEnOnly = await makeWorker(caller, managerId, {
      name: "原始姓名",
      nameEn: "AGUS PRATAMA",
      nameCn: undefined,
    });

    expect((await caller.workers.getById({ id: withCn })).name).toBe("布迪");
    expect((await caller.workers.getById({ id: withEnOnly })).name).toBe(
      "AGUS PRATAMA"
    );
  });

  it("回傳的 id 指向剛建立的那一筆（前端可據此導向詳情頁）", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    // 先建一筆干擾資料，確保回傳的不是「最後一筆」這種巧合
    await makeWorker(caller, managerId, { nameCn: "先建立的移工" });

    const result = await caller.workers.create({
      name: "要導向的移工",
      nameCn: "要導向的移工",
      lifecycleStatus: "idle_in_tw",
      documentStatus: "not_started",
      managerId,
    } as Parameters<typeof caller.workers.create>[0]);

    expect(result.success).toBe(true);
    expect(result.id).toBeGreaterThan(0);
    expect((await caller.workers.getById({ id: result.id })).name).toBe(
      "要導向的移工"
    );
  });

  it("電話存進資料庫時會去掉連字號", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);

    const workerId = await makeWorker(caller, managerId, {
      phone: "09-1234-5678",
    });

    const rows = await query<{ phone: string }>(
      "SELECT phone FROM workers WHERE id = ?",
      [workerId]
    );
    expect(rows[0].phone).toBe("0912345678");
  });

  it("拒絕格式錯誤的居留證號，且不留下半筆資料", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);

    await expect(
      makeWorker(caller, managerId, { residentPermitNo: "AB123" })
    ).rejects.toThrow(/居留證/);

    expect(await query("SELECT id FROM workers")).toHaveLength(0);
  });

  it("拒絕重複的居留證號（唯一性是真的去查資料表）", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeWorker(caller, managerId, { residentPermitNo: "A123456789" });

    await expect(
      makeWorker(caller, managerId, {
        nameCn: "另一位移工",
        residentPermitNo: "A123456789",
      })
    ).rejects.toThrow(/已存在/);

    expect(await query("SELECT id FROM workers")).toHaveLength(1);
  });

  it("拒絕重複的護照號碼", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeWorker(caller, managerId, { passportNo: "X1234567" });

    await expect(
      makeWorker(caller, managerId, {
        nameCn: "另一位移工",
        passportNo: "X1234567",
      })
    ).rejects.toThrow(/已存在/);
  });

  it("拒絕格式錯誤的護照號碼（少於 6 碼）", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);

    await expect(
      makeWorker(caller, managerId, { passportNo: "X123" })
    ).rejects.toThrow(/護照/);
  });

  it("拒絕晚於今天的入境日期", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);

    await expect(
      makeWorker(caller, managerId, { entryDate: dayOffset(1) })
    ).rejects.toThrow(/入境日期/);
  });

  it("拒絕「在職中」卻文件未啟動的組合（跨欄位驗證）", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);

    await expect(
      makeWorker(caller, managerId, {
        lifecycleStatus: "employed",
        documentStatus: "not_started",
      })
    ).rejects.toThrow(/在職/);

    expect(await query("SELECT id FROM workers")).toHaveLength(0);
  });

  it("拒絕非 http(s) 的外部連結", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);

    await expect(
      makeWorker(caller, managerId, { externalLink: "drive.google.com/abc" })
    ).rejects.toThrow(/連結/);
  });
});

describe("workers.getById", () => {
  it("附加證件剩餘天數等自動計算欄位", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const workerId = await makeWorker(caller, managerId, {
      residentPermitExpiry: dayOffset(30),
      passportExpiry: dayOffset(-3),
    });

    const result = await caller.workers.getById({ id: workerId });

    expect(result.residentPermitDaysLeft).toBe(30);
    expect(result.passportDaysLeft).toBe(-3);
  });

  it("下次體檢日期為最近體檢日 + 5 個月", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    // 這裡用固定日期是安全的：計算是純粹的「+5 個月」位移，不隨今天變動。
    const workerId = await makeWorker(caller, managerId, {
      lastMedicalExamDate: "2020-03-10",
    });

    const result = await caller.workers.getById({ id: workerId });

    expect(result.nextMedicalExamDate).toBe("2020-08-10");
  });

  it("沒有證件日期時計算欄位為 null 而非 0", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const workerId = await makeWorker(caller, managerId);

    const result = await caller.workers.getById({ id: workerId });

    expect(result.residentPermitDaysLeft).toBeNull();
    expect(result.passportDaysLeft).toBeNull();
    expect(result.nextMedicalExamDate).toBeNull();
    expect(result.nextMedicalExamDaysLeft).toBeNull();
  });

  it("查無資料時拋出 NOT_FOUND", async () => {
    const caller = createCaller();
    await expect(caller.workers.getById({ id: 999999 })).rejects.toThrow(
      /找不到/
    );
  });
});

describe("workers.list", () => {
  it("列出所有移工並附上計算欄位", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const workerId = await makeWorker(caller, managerId, {
      nameCn: "阿米娜",
      residentPermitExpiry: dayOffset(7),
    });
    await makeWorker(caller, managerId, { nameCn: "布迪" });

    const result = await caller.workers.list();

    expect(result).toHaveLength(2);
    const target = result.find(w => w.id === workerId);
    expect(target?.residentPermitDaysLeft).toBe(7);
  });

  it("空資料庫回傳空陣列而非報錯", async () => {
    const caller = createCaller();
    await expect(caller.workers.list()).resolves.toEqual([]);
  });
});

describe("workers.update", () => {
  it("更新後的欄位真的寫回資料庫", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const workerId = await makeWorker(caller, managerId, { nameCn: "舊名字" });

    await caller.workers.update({
      id: workerId,
      name: "新名字",
      nameCn: "新名字",
      lifecycleStatus: "employed",
      documentStatus: "complete",
      managerId,
    } as Parameters<typeof caller.workers.update>[0]);

    const rows = await query<{ name: string; lifecycleStatus: string }>(
      "SELECT name, lifecycleStatus FROM workers WHERE id = ?",
      [workerId]
    );
    expect(rows[0].name).toBe("新名字");
    expect(rows[0].lifecycleStatus).toBe("employed");
  });

  it("未帶的選填欄位會被清成 null（整筆覆寫語意）", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const workerId = await makeWorker(caller, managerId, {
      nameCn: "阿米娜",
      notes: "原本的備註",
    });

    await caller.workers.update({
      id: workerId,
      name: "阿米娜",
      nameCn: "阿米娜",
      lifecycleStatus: "idle_in_tw",
      documentStatus: "not_started",
      managerId,
    } as Parameters<typeof caller.workers.update>[0]);

    const rows = await query<{ notes: string | null }>(
      "SELECT notes FROM workers WHERE id = ?",
      [workerId]
    );
    expect(rows[0].notes).toBeNull();
  });

  it("保留自己原本的居留證號不會被判定為重複", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const workerId = await makeWorker(caller, managerId, {
      nameCn: "阿米娜",
      residentPermitNo: "A123456789",
    });

    await expect(
      caller.workers.update({
        id: workerId,
        name: "阿米娜",
        nameCn: "阿米娜",
        lifecycleStatus: "idle_in_tw",
        documentStatus: "not_started",
        managerId,
        residentPermitNo: "A123456789",
      } as Parameters<typeof caller.workers.update>[0])
    ).resolves.toEqual({ success: true });
  });

  it("改成別人已在用的居留證號會被擋下", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeWorker(caller, managerId, { residentPermitNo: "A123456789" });
    const workerId = await makeWorker(caller, managerId, {
      nameCn: "阿米娜",
      residentPermitNo: "B987654321",
    });

    await expect(
      caller.workers.update({
        id: workerId,
        name: "阿米娜",
        nameCn: "阿米娜",
        lifecycleStatus: "idle_in_tw",
        documentStatus: "not_started",
        managerId,
        residentPermitNo: "A123456789",
      } as Parameters<typeof caller.workers.update>[0])
    ).rejects.toThrow(/已存在/);

    const rows = await query<{ residentPermitNo: string }>(
      "SELECT residentPermitNo FROM workers WHERE id = ?",
      [workerId]
    );
    expect(rows[0].residentPermitNo).toBe("B987654321");
  });
});

describe("workers.delete", () => {
  it("刪除後資料表不再有該筆，其他移工不受影響", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const target = await makeWorker(caller, managerId, { nameCn: "要刪的" });
    const survivor = await makeWorker(caller, managerId, { nameCn: "留下的" });

    await caller.workers.delete({ id: target });

    const rows = await query<{ id: number }>("SELECT id FROM workers");
    expect(rows.map(r => r.id)).toEqual([survivor]);
  });
});

describe("workers.import", () => {
  it("整批成功時逐筆寫入資料庫", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);

    const result = await caller.workers.import({
      rows: [
        {
          name: "移工甲",
          nameCn: "移工甲",
          lifecycleStatus: "idle_in_tw",
          documentStatus: "not_started",
          managerId,
        },
        {
          name: "移工乙",
          nameCn: "移工乙",
          lifecycleStatus: "preparing_abroad",
          documentStatus: "pending_supplement",
          managerId,
        },
      ],
    } as Parameters<typeof caller.workers.import>[0]);

    expect(result.successCount).toBe(2);
    expect(result.failCount).toBe(0);
    expect(await query("SELECT id FROM workers")).toHaveLength(2);
  });

  it("部分失敗時成功的仍寫入，失敗的回報 index 與原因", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);

    const result = await caller.workers.import({
      rows: [
        {
          name: "正常的",
          nameCn: "正常的",
          lifecycleStatus: "idle_in_tw",
          documentStatus: "not_started",
          managerId,
        },
        {
          name: "居留證亂填的",
          nameCn: "居留證亂填的",
          lifecycleStatus: "idle_in_tw",
          documentStatus: "not_started",
          managerId,
          residentPermitNo: "XX99",
        },
        {
          name: "狀態互斥的",
          nameCn: "狀態互斥的",
          lifecycleStatus: "employed",
          documentStatus: "not_started",
          managerId,
        },
      ],
    } as Parameters<typeof caller.workers.import>[0]);

    expect(result.successCount).toBe(1);
    expect(result.failCount).toBe(2);
    expect(result.results[1]).toMatchObject({ index: 1, success: false });
    expect(result.results[1].error).toMatch(/居留證/);
    expect(result.results[2].error).toMatch(/在職/);

    const rows = await query<{ name: string }>("SELECT name FROM workers");
    expect(rows.map(r => r.name)).toEqual(["正常的"]);
  });

  it("同一批內重複的居留證號，第二筆會被唯一性檢查擋下", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const row = {
      name: "重複證號",
      nameCn: "重複證號",
      lifecycleStatus: "idle_in_tw",
      documentStatus: "not_started",
      managerId,
      residentPermitNo: "A123456789",
    };

    const result = await caller.workers.import({
      rows: [row, { ...row, name: "重複證號二", nameCn: "重複證號二" }],
    } as Parameters<typeof caller.workers.import>[0]);

    expect(result.successCount).toBe(1);
    expect(result.results[1].error).toMatch(/已存在/);
  });

  it("空陣列不報錯，計數為 0", async () => {
    const caller = createCaller();
    await expect(caller.workers.import({ rows: [] })).resolves.toMatchObject({
      successCount: 0,
      failCount: 0,
    });
  });
});

describe("dashboard.summary 計數", () => {
  it("totals 與資料表實際筆數一致", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId);
    await makeCustomer(caller, managerId, { name: "第二家雇主股份有限公司" });
    await makeCase(caller, customerId, managerId);
    await makeWorker(caller, managerId, { nameCn: "在職甲", ...EMPLOYED });
    await makeWorker(caller, managerId, { nameCn: "在職乙", ...EMPLOYED });
    await makeWorker(caller, managerId, { nameCn: "待業丙" });

    const summary = await caller.dashboard.summary();

    expect(summary.totals).toMatchObject({
      workers: 3,
      customers: 2,
      cases: 1,
      employed: 2,
    });
  });

  it("各維度分布以 schema enum 順序回傳，缺漏的狀態補 0", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeWorker(caller, managerId, { nameCn: "待業甲" });

    const summary = await caller.dashboard.summary();

    expect(summary.workersByLifecycle).toEqual([
      { value: "employed", count: 0 },
      { value: "idle_in_tw", count: 1 },
      { value: "preparing_abroad", count: 0 },
      { value: "returned", count: 0 },
      { value: "absconded", count: 0 },
    ]);
    expect(summary.casesByStatus.map(r => r.value)).toEqual([
      "in_progress",
      "completed",
      "paused",
      "cancelled",
    ]);
    expect(summary.customersByType.map(r => r.value)).toEqual([
      "individual",
      "company",
    ]);
  });

  it("空資料庫時全部為 0，不報錯", async () => {
    const caller = createCaller();

    const summary = await caller.dashboard.summary();

    expect(summary.totals).toEqual({
      workers: 0,
      customers: 0,
      cases: 0,
      employed: 0,
      expiringSoon: 0,
      expired: 0,
    });
    expect(summary.expiringDocuments).toEqual([]);
  });
});

describe("dashboard.summary 證件到期口徑", () => {
  it("expiringSoon / expired 算的是「人數」而非「證件數」", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    // 同一人的居留證與護照都即將到期 —— 清單有兩筆，但人數只能算一個
    await makeWorker(caller, managerId, {
      nameCn: "兩證都快到期",
      residentPermitExpiry: dayOffset(10),
      passportExpiry: dayOffset(20),
    });

    const summary = await caller.dashboard.summary();

    expect(summary.expiringDocuments).toHaveLength(2);
    expect(summary.totals.expiringSoon).toBe(1);
    expect(summary.totals.expired).toBe(0);
  });

  it("兩種到期狀態互斥：有任一張已過期就只算「已過期」", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeWorker(caller, managerId, {
      nameCn: "一張過期一張快到期",
      residentPermitExpiry: dayOffset(-5),
      passportExpiry: dayOffset(10),
    });

    const summary = await caller.dashboard.summary();

    expect(summary.totals.expired).toBe(1);
    expect(summary.totals.expiringSoon).toBe(0);
    expect(summary.expiringDocuments).toHaveLength(2);
  });

  it("今天到期（daysLeft = 0）歸類為即將到期，不算已過期", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeWorker(caller, managerId, {
      nameCn: "今天到期",
      residentPermitExpiry: dayOffset(0),
    });

    const summary = await caller.dashboard.summary();

    expect(summary.expiringDocuments[0].daysLeft).toBe(0);
    expect(summary.totals.expiringSoon).toBe(1);
    expect(summary.totals.expired).toBe(0);
  });

  it("60 天窗口的邊界：第 60 天算進來，第 61 天不算", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeWorker(caller, managerId, {
      nameCn: "剛好六十天",
      residentPermitExpiry: dayOffset(60),
    });
    await makeWorker(caller, managerId, {
      nameCn: "六十一天",
      residentPermitExpiry: dayOffset(61),
    });

    const summary = await caller.dashboard.summary();

    expect(summary.totals.expiringSoon).toBe(1);
    expect(summary.expiringDocuments.map(d => d.name)).toEqual(["剛好六十天"]);
  });

  it("已結案（已回國／逃跑）的移工不列入到期統計", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeWorker(caller, managerId, {
      nameCn: "已回國",
      lifecycleStatus: "returned",
      residentPermitExpiry: dayOffset(-10),
    });
    await makeWorker(caller, managerId, {
      nameCn: "已逃跑",
      lifecycleStatus: "absconded",
      residentPermitExpiry: dayOffset(5),
    });

    const summary = await caller.dashboard.summary();

    expect(summary.expiringDocuments).toEqual([]);
    expect(summary.totals.expired).toBe(0);
    expect(summary.totals.expiringSoon).toBe(0);
  });

  it("只有一張證件落在窗口內時，同一人另一張遠期證件不會被帶出來", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeWorker(caller, managerId, {
      nameCn: "護照還很久",
      residentPermitExpiry: dayOffset(15),
      passportExpiry: dayOffset(900),
    });

    const summary = await caller.dashboard.summary();

    expect(summary.expiringDocuments).toHaveLength(1);
    expect(summary.expiringDocuments[0].docType).toBe("residentPermit");
  });

  it("expiringDocuments 依剩餘天數由少到多排序", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeWorker(caller, managerId, {
      nameCn: "三十天",
      residentPermitExpiry: dayOffset(30),
    });
    await makeWorker(caller, managerId, {
      nameCn: "已過期",
      residentPermitExpiry: dayOffset(-5),
    });
    await makeWorker(caller, managerId, {
      nameCn: "十天",
      residentPermitExpiry: dayOffset(10),
    });

    const summary = await caller.dashboard.summary();

    expect(summary.expiringDocuments.map(d => d.daysLeft)).toEqual([
      -5, 10, 30,
    ]);
    expect(summary.expiringDocuments.map(d => d.name)).toEqual([
      "已過期",
      "十天",
      "三十天",
    ]);
  });
});

describe("dashboard.summary 趨勢與 KPI 快照", () => {
  it("沒有前一筆快照時 trends 為 null，但仍寫入當日快照", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeWorker(caller, managerId, { nameCn: "阿米娜" });

    const summary = await caller.dashboard.summary();

    expect(summary.trends).toBeNull();
    const rows = await query<{ snapshotDate: string; workers: number }>(
      "SELECT snapshotDate, workers FROM kpi_snapshots"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].snapshotDate).toBe(taipeiToday());
    expect(rows[0].workers).toBe(1);
  });

  it("有前一筆快照時 trends 為差值，since 指向該快照日期", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const yesterday = dayOffset(-1);
    await query(
      "INSERT INTO kpi_snapshots (snapshotDate, workers, customers, `cases`, employed, expiringSoon, expired) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [yesterday, 1, 0, 0, 0, 0, 0]
    );

    await makeWorker(caller, managerId, { nameCn: "在職甲", ...EMPLOYED });
    await makeWorker(caller, managerId, { nameCn: "在職乙", ...EMPLOYED });
    await makeWorker(caller, managerId, { nameCn: "待業丙" });

    const summary = await caller.dashboard.summary();

    expect(summary.trends).toEqual({
      workers: 2,
      customers: 0,
      cases: 0,
      employed: 2,
      expiringSoon: 0,
      expired: 0,
      since: yesterday,
    });
  });

  it("趨勢可以是負的（資料變少時）", async () => {
    const caller = createCaller();
    await query(
      "INSERT INTO kpi_snapshots (snapshotDate, workers, customers, `cases`, employed, expiringSoon, expired) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [dayOffset(-3), 5, 0, 0, 0, 0, 0]
    );

    const summary = await caller.dashboard.summary();

    expect(summary.trends?.workers).toBe(-5);
    expect(summary.trends?.since).toBe(dayOffset(-3));
  });

  it("只跟「最接近今天」的那筆舊快照比較", async () => {
    const caller = createCaller();
    await query(
      "INSERT INTO kpi_snapshots (snapshotDate, workers, customers, `cases`, employed, expiringSoon, expired) VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)",
      [dayOffset(-30), 100, 0, 0, 0, 0, 0, dayOffset(-2), 3, 0, 0, 0, 0, 0]
    );

    const summary = await caller.dashboard.summary();

    expect(summary.trends?.since).toBe(dayOffset(-2));
    expect(summary.trends?.workers).toBe(-3);
  });

  it("同一天重複查看只保留一筆快照，數值更新為最新", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await caller.dashboard.summary();

    await makeWorker(caller, managerId, { nameCn: "後來才建的" });
    const second = await caller.dashboard.summary();

    // 當日快照被 upsert 覆寫，不會多出一筆；也因為沒有更早的快照，趨勢仍是 null
    expect(second.trends).toBeNull();
    const rows = await query<{ snapshotDate: string; workers: number }>(
      "SELECT snapshotDate, workers FROM kpi_snapshots"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].workers).toBe(1);
  });

  it("寫入快照的到期人數與本次回傳的 totals 一致", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeWorker(caller, managerId, {
      nameCn: "已過期",
      residentPermitExpiry: dayOffset(-1),
      passportExpiry: dayOffset(-2),
    });
    await makeWorker(caller, managerId, {
      nameCn: "快到期",
      residentPermitExpiry: dayOffset(20),
    });

    const summary = await caller.dashboard.summary();

    const rows = await query<{ expiringSoon: number; expired: number }>(
      "SELECT expiringSoon, expired FROM kpi_snapshots WHERE snapshotDate = ?",
      [taipeiToday()]
    );
    expect(rows[0].expired).toBe(summary.totals.expired);
    expect(rows[0].expiringSoon).toBe(summary.totals.expiringSoon);
    expect(rows[0].expired).toBe(1);
    expect(rows[0].expiringSoon).toBe(1);
  });
});

describe("dashboard.summary 的韌性", () => {
  it("KPI 快照表壞掉時，核心數字仍然出得來（只是沒有趨勢）", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    await makeWorker(caller, managerId, { ...EMPLOYED, nameCn: "在職甲" });

    // 直接把快照表改名，模擬「查詢會失敗」的情境。這比 mock 更貼近真實 ——
    // 實際踩到的是 schema 變更後連線池裡的 prepared statement 失效。
    await query("RENAME TABLE kpi_snapshots TO kpi_snapshots_hidden");
    try {
      const summary = await caller.dashboard.summary();

      // 趨勢降級成 null，但每天要看的數字一個都不能少
      expect(summary.trends).toBeNull();
      expect(summary.totals.workers).toBe(1);
      expect(summary.totals.employed).toBe(1);
      expect(summary.workersByLifecycle.length).toBeGreaterThan(0);
    } finally {
      await query("RENAME TABLE kpi_snapshots_hidden TO kpi_snapshots");
    }
  });
});
