import { describe, it, expect } from "vitest";
import {
  addMonthsYmd,
  addDaysYmd,
  evaluateHealthChecks,
  isActionableStatus,
  statusRank,
  classifyDeadline,
} from "@shared/healthCheck";

describe("addMonthsYmd（UTC 曆加月，含月底夾值）", () => {
  it("一般加月", () => {
    expect(addMonthsYmd("2025-09-01", 6)).toBe("2026-03-01");
    expect(addMonthsYmd("2025-09-01", 18)).toBe("2027-03-01");
    expect(addMonthsYmd("2025-09-01", 30)).toBe("2028-03-01");
  });
  it("跨閏年 / 月底夾值", () => {
    // 8/31 + 6 個月 → 2 月無 31 日，夾到 2 月最後一天
    expect(addMonthsYmd("2023-08-31", 6)).toBe("2024-02-29"); // 2024 閏年
    expect(addMonthsYmd("2025-08-31", 6)).toBe("2026-02-28");
  });
  it("非法輸入原樣回傳", () => {
    expect(addMonthsYmd("bad", 6)).toBe("bad");
  });
});

describe("addDaysYmd", () => {
  it("跨月加減天", () => {
    expect(addDaysYmd("2026-03-01", -30)).toBe("2026-01-30");
    expect(addDaysYmd("2026-03-01", 30)).toBe("2026-03-31");
  });
});

describe("evaluateHealthChecks — 衛生局公文情境", () => {
  // 公文事實：聘僱許可工作起始日 = 114/9/1（2025-09-01）
  // 6 個月基準日 = 2026-03-01，前後 30 日窗口 = 2026-01-30 ~ 2026-03-31
  const anchorDate = "2025-09-01";

  it("窗口早已過、未登錄 → overdue（就是收到公文的情形）", () => {
    // 公文發文日 115/7/15，今天設 2026-07-21
    const results = evaluateHealthChecks({
      anchorDate,
      today: "2026-07-21",
      recorded: {},
    });
    const m6 = results.find(r => r.milestone === 6)!;
    expect(m6.dueDate).toBe("2026-03-01");
    expect(m6.windowStart).toBe("2026-01-30");
    expect(m6.windowEnd).toBe("2026-03-31");
    expect(m6.status).toBe("overdue");
    expect(m6.daysToWindowEnd).toBeLessThan(0); // 已過窗口
    // 18 / 30 個月仍在未來
    expect(results.find(r => r.milestone === 18)!.status).toBe("future");
    expect(results.find(r => r.milestone === 30)!.status).toBe("future");
  });

  it("已登錄 6 個月體檢 → done，不再提醒", () => {
    const results = evaluateHealthChecks({
      anchorDate,
      today: "2026-07-21",
      recorded: { 6: "2026-02-20" },
    });
    const m6 = results.find(r => r.milestone === 6)!;
    expect(m6.status).toBe("done");
    expect(isActionableStatus(m6.status)).toBe(false);
  });

  it("今天落在窗口內 → due_now", () => {
    const results = evaluateHealthChecks({
      anchorDate,
      today: "2026-02-15",
      recorded: {},
    });
    expect(results.find(r => r.milestone === 6)!.status).toBe("due_now");
  });

  it("窗口開啟前、進入提前提醒天數 → upcoming", () => {
    // windowStart = 2026-01-30，leadDays 45 → 2025-12-16 起提醒
    const results = evaluateHealthChecks({
      anchorDate,
      today: "2025-12-20",
      recorded: {},
    });
    expect(results.find(r => r.milestone === 6)!.status).toBe("upcoming");
  });

  it("提前提醒天數之前 → future（不打擾）", () => {
    const results = evaluateHealthChecks({
      anchorDate,
      today: "2025-11-01",
      recorded: {},
    });
    expect(results.find(r => r.milestone === 6)!.status).toBe("future");
    expect(isActionableStatus("future")).toBe(false);
  });

  it("空白字串視為未登錄", () => {
    const results = evaluateHealthChecks({
      anchorDate,
      today: "2026-07-21",
      recorded: { 6: "   " },
    });
    expect(results.find(r => r.milestone === 6)!.status).toBe("overdue");
  });
});

describe("邊界：窗口迄日當天仍屬 due_now，隔天才 overdue", () => {
  const anchorDate = "2025-09-01"; // windowEnd = 2026-03-31
  it("窗口最後一天 = due_now", () => {
    const r = evaluateHealthChecks({
      anchorDate,
      today: "2026-03-31",
      recorded: {},
    });
    expect(r.find(x => x.milestone === 6)!.status).toBe("due_now");
  });
  it("窗口隔天 = overdue", () => {
    const r = evaluateHealthChecks({
      anchorDate,
      today: "2026-04-01",
      recorded: {},
    });
    expect(r.find(x => x.milestone === 6)!.status).toBe("overdue");
  });
});

describe("非法基準日回傳空陣列", () => {
  it("anchorDate 非法", () => {
    expect(
      evaluateHealthChecks({
        anchorDate: "",
        today: "2026-07-21",
        recorded: {},
      })
    ).toEqual([]);
  });
});

describe("statusRank 排序（逾期最前）", () => {
  it("順序正確", () => {
    expect(statusRank("overdue")).toBeLessThan(statusRank("due_now"));
    expect(statusRank("due_now")).toBeLessThan(statusRank("upcoming"));
    expect(statusRank("upcoming")).toBeLessThan(statusRank("future"));
  });
});

describe("classifyDeadline — 固定到期日（聘僱許可續聘 / 居留證展延）", () => {
  // 預設 leadDays=120、criticalDays=60
  it("已過到期日 → overdue，daysLeft 為負", () => {
    const r = classifyDeadline("2026-06-01", "2026-07-21")!;
    expect(r.status).toBe("overdue");
    expect(r.daysLeft).toBeLessThan(0);
  });
  it("距到期 30 天（≤60）→ due_now", () => {
    expect(classifyDeadline("2026-08-20", "2026-07-21")!.status).toBe(
      "due_now"
    );
  });
  it("距到期 90 天（60<x≤120）→ upcoming", () => {
    expect(classifyDeadline("2026-10-19", "2026-07-21")!.status).toBe(
      "upcoming"
    );
  });
  it("距到期 200 天 → future", () => {
    expect(classifyDeadline("2027-02-06", "2026-07-21")!.status).toBe("future");
  });
  it("可自訂 lead / critical 天數", () => {
    const r = classifyDeadline("2026-08-01", "2026-07-21", {
      leadDays: 30,
      criticalDays: 7,
    })!;
    expect(r.status).toBe("upcoming"); // 11 天，落在 7<x≤30
  });
  it("到期日當天 → due_now（daysLeft 0）", () => {
    const r = classifyDeadline("2026-07-21", "2026-07-21")!;
    expect(r.status).toBe("due_now");
    expect(r.daysLeft).toBe(0);
  });
  it("非法輸入回傳 null", () => {
    expect(classifyDeadline("", "2026-07-21")).toBeNull();
  });
});

describe("evaluateHealthChecks — 健檢資料分兩處（worker 檔 fallback）", () => {
  const anchorDate = "2025-09-01"; // 6 個月窗口 2026-01-30 ~ 2026-03-31

  it("案件層未登錄、但移工檔體檢日落在窗口內 → done（來源 worker），不誤判逾期", () => {
    const results = evaluateHealthChecks({
      anchorDate,
      today: "2026-07-21",
      recorded: {}, // 案件層空白
      fallbackExamDates: ["2026-02-10"], // 移工檔 lastMedicalExamDate 落在 6 個月窗口
    });
    const m6 = results.find(r => r.milestone === 6)!;
    expect(m6.status).toBe("done");
    expect(m6.recordedSource).toBe("worker");
    expect(m6.recordedDate).toBe("2026-02-10");
  });

  it("移工檔體檢日不在窗口內 → 仍為 overdue（不會誤判為完成）", () => {
    const results = evaluateHealthChecks({
      anchorDate,
      today: "2026-07-21",
      recorded: {},
      fallbackExamDates: ["2025-10-01"], // 早於 6 個月窗口
    });
    expect(results.find(r => r.milestone === 6)!.status).toBe("overdue");
  });

  it("案件層有登錄時優先採用（來源 case）", () => {
    const results = evaluateHealthChecks({
      anchorDate,
      today: "2026-07-21",
      recorded: { 6: "2026-03-05" },
      fallbackExamDates: ["2026-02-10"],
    });
    const m6 = results.find(r => r.milestone === 6)!;
    expect(m6.recordedSource).toBe("case");
    expect(m6.recordedDate).toBe("2026-03-05");
  });

  it("未提供 fallback 時 recordedSource 為 null", () => {
    const results = evaluateHealthChecks({
      anchorDate,
      today: "2026-07-21",
      recorded: {},
    });
    expect(results.find(r => r.milestone === 6)!.recordedSource).toBeNull();
  });
});
