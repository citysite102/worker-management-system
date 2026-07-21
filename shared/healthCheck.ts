// ─── 受聘僱外國人「定期健康檢查」合規排程引擎 ───────────────────────────────
//
// 法源：受聘僱外國人健康檢查管理辦法第 6 條。
// 外國人受聘僱從事家庭看護等工作，須於「聘僱許可工作起始日」屆滿
//   ‑ 工作滿  6 個月
//   ‑ 工作滿 18 個月
//   ‑ 工作滿 30 個月
// 之日的「前後 30 日內」各辦理一次定期健康檢查；逾期未辦即違規，會被
// 衛生局移送勞工局依就業服務法認定裁處（本引擎即為避免此情形而生）。
//
// 本檔為「純函式」，不碰資料庫、不依賴時區設定（一律以 UTC 曆計算日字串），
// 因此 server（含未來的排程寄信）、client、單元測試三方共用同一份判定邏輯。

export const HEALTH_CHECK_MILESTONES = [6, 18, 30] as const;
export type HealthCheckMilestone = (typeof HEALTH_CHECK_MILESTONES)[number];

/**
 * done     ：已完成（有登錄該次體檢日期）
 * overdue  ：逾期（窗口結束日已過、且未登錄）— 就是會收到公文的情形 🔴
 * due_now  ：辦理中（今天落在前後 30 日窗口內）🟠
 * upcoming ：窗口即將開啟（進入提前提醒天數內）🟡
 * future   ：未到期（時間還早，不需提醒）
 */
export type HealthCheckStatus =
  | "done"
  | "overdue"
  | "due_now"
  | "upcoming"
  | "future";

export interface MilestoneResult {
  milestone: HealthCheckMilestone;
  /** 應辦理基準日 = 起始日 + N 個月 */
  dueDate: string; // YYYY-MM-DD
  /** 窗口起日 = dueDate − windowDays */
  windowStart: string; // YYYY-MM-DD
  /** 窗口迄日 = dueDate + windowDays */
  windowEnd: string; // YYYY-MM-DD
  /** 已登錄的實際體檢日；未登錄為 null */
  recordedDate: string | null;
  /** 完成日的登錄來源：case=案件體檢欄位、worker=移工檔體檢日（落在窗口內）、null=未完成 */
  recordedSource: "case" | "worker" | null;
  status: HealthCheckStatus;
  /** 今天 → dueDate 的天數；正數＝還有幾天到期，負數＝已過基準日幾天 */
  daysToDue: number;
  /** 今天 → windowEnd 的天數；負數＝逾期幾天（過了容許窗口） */
  daysToWindowEnd: number;
}

const DAY_MS = 86400000;

/** 解析 YYYY-MM-DD 為 UTC 午夜時間戳；非法字串回傳 NaN。 */
function parseYmd(s: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;
  return Date.parse(s + "T00:00:00Z");
}

function toYmd(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** 以 UTC 曆加減月份，遇月底溢位（如 8/31 + 1 月）夾到目標月最後一天。 */
export function addMonthsYmd(dateStr: string, months: number): string {
  const ts = parseYmd(dateStr);
  if (Number.isNaN(ts)) return dateStr;
  const d = new Date(ts);
  const day = d.getUTCDate();
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1)
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return toYmd(target.getTime());
}

export function addDaysYmd(dateStr: string, days: number): string {
  const ts = parseYmd(dateStr);
  if (Number.isNaN(ts)) return dateStr;
  return toYmd(ts + days * DAY_MS);
}

/** a → b 的日數差（b − a），以整日計。 */
function diffDays(a: string, b: string): number {
  return Math.round((parseYmd(b) - parseYmd(a)) / DAY_MS);
}

export interface EvaluateParams {
  /** 聘僱許可工作起始日（基準日），通常取雇主資格的 approvedStartDate。 */
  anchorDate: string;
  /** 今天（台北時區的 YYYY-MM-DD），由呼叫端注入以利測試與排程。 */
  today: string;
  /** 各里程碑已登錄的實際體檢日；未做為 null/undefined。 */
  recorded: Partial<Record<HealthCheckMilestone, string | null | undefined>>;
  /** 前後容許窗口天數，預設 30（法規為前後 30 日）。 */
  windowDays?: number;
  /** 窗口開啟前多少天開始提醒（upcoming），預設 45。 */
  leadDays?: number;
  /** 只評估這些里程碑，預設全部 6/18/30。 */
  milestones?: readonly HealthCheckMilestone[];
  /**
   * 移工檔案上另外記錄的體檢日期（如 workers.lastMedicalExamDate）。
   * 處理「健檢資料分兩處」：某里程碑案件層未登錄，但移工檔有一筆落在該窗口內的
   * 體檢日，即視為已完成（recordedSource="worker"），避免誤判逾期。
   */
  fallbackExamDates?: (string | null | undefined)[];
}

/**
 * 針對單一聘僱（單一基準日）計算 6/18/30 個月三次定期健檢的合規狀態。
 * 回傳陣列涵蓋所有里程碑；呼叫端可用 `isActionableStatus` 篩出需要提醒的項目。
 */
export function evaluateHealthChecks(
  params: EvaluateParams
): MilestoneResult[] {
  const {
    anchorDate,
    today,
    recorded,
    windowDays = 30,
    leadDays = 45,
    milestones = HEALTH_CHECK_MILESTONES,
    fallbackExamDates = [],
  } = params;

  if (Number.isNaN(parseYmd(anchorDate)) || Number.isNaN(parseYmd(today)))
    return [];

  const fallbacks = fallbackExamDates
    .map(d => (d && d.trim() ? d.trim() : null))
    .filter((d): d is string => d !== null && !Number.isNaN(parseYmd(d)));

  return milestones.map(milestone => {
    const dueDate = addMonthsYmd(anchorDate, milestone);
    const windowStart = addDaysYmd(dueDate, -windowDays);
    const windowEnd = addDaysYmd(dueDate, windowDays);
    const rec = recorded[milestone];
    let recordedDate = rec && rec.trim() ? rec.trim() : null;
    let recordedSource: "case" | "worker" | null = recordedDate ? "case" : null;

    // 案件層未登錄時，退而看移工檔是否有落在此窗口內的體檢日
    if (!recordedDate) {
      const match = fallbacks.find(d => d >= windowStart && d <= windowEnd);
      if (match) {
        recordedDate = match;
        recordedSource = "worker";
      }
    }

    let status: HealthCheckStatus;
    if (recordedDate) {
      status = "done";
    } else if (today > windowEnd) {
      status = "overdue";
    } else if (today >= windowStart) {
      status = "due_now";
    } else if (today >= addDaysYmd(windowStart, -leadDays)) {
      status = "upcoming";
    } else {
      status = "future";
    }

    return {
      milestone,
      dueDate,
      windowStart,
      windowEnd,
      recordedDate,
      recordedSource,
      status,
      daysToDue: diffDays(today, dueDate),
      daysToWindowEnd: diffDays(today, windowEnd),
    };
  });
}

/** 是否為「需要出現在提醒清單」的狀態（逾期 / 辦理中 / 即將開窗）。 */
export function isActionableStatus(status: HealthCheckStatus): boolean {
  return status === "overdue" || status === "due_now" || status === "upcoming";
}

/** 排序權重：逾期最前，其次辦理中、即將開窗。 */
export function statusRank(status: HealthCheckStatus): number {
  switch (status) {
    case "overdue":
      return 0;
    case "due_now":
      return 1;
    case "upcoming":
      return 2;
    default:
      return 3;
  }
}

export function milestoneLabel(milestone: HealthCheckMilestone): string {
  return `工作滿 ${milestone} 個月健檢`;
}

// ─── 固定到期日分級器（聘僱許可續聘 / 居留證展延等單一期限型義務）─────────────
//
// 健檢有「前後 30 日窗口」，但多數法定義務是「某日前必須完成」的單一期限
// （如聘僱許可截止日前要辦續聘、居留證到期前要展延）。本分級器處理這類固定日：
//   overdue  ：已過期（今天 > 到期日）
//   due_now  ：緊迫（距到期 ≤ criticalDays 天）
//   upcoming ：進入提前提醒範圍（距到期 ≤ leadDays 天）
//   future   ：時間還早
export interface DeadlineResult {
  dueDate: string; // YYYY-MM-DD
  status: HealthCheckStatus; // 只會是 overdue / due_now / upcoming / future
  daysLeft: number; // 今天 → 到期日；負數＝已過期幾天
}

export function classifyDeadline(
  dueDate: string,
  today: string,
  opts: { leadDays?: number; criticalDays?: number } = {}
): DeadlineResult | null {
  const { leadDays = 120, criticalDays = 60 } = opts;
  if (Number.isNaN(parseYmd(dueDate)) || Number.isNaN(parseYmd(today)))
    return null;
  const daysLeft = diffDays(today, dueDate);
  let status: HealthCheckStatus;
  if (daysLeft < 0) status = "overdue";
  else if (daysLeft <= criticalDays) status = "due_now";
  else if (daysLeft <= leadDays) status = "upcoming";
  else status = "future";
  return { dueDate, status, daysLeft };
}
