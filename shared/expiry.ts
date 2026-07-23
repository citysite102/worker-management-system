// ─── 到期／期限分級引擎（單一來源；server / client / 測試共用）─────────────────
//
// 全站「距到期天數 → 緊迫程度」的判定一律走這裡，避免前後端各自為政、門檻漂移。
// 這裡刻意並列「兩套政策」，讓門檻放在同一檔、一起被 review：
//
//   1. 證件／文件上色（expiryTier，5 段：14 / 30 / 90 天）
//      —— 給前端清單就地標色用，色階較細。
//   2. 固定期限分級（classifyDeadline，4 段：60 / 120 天）
//      —— 給儀表板合規（續聘、居留展延等單一法定期限）用，需較長提前量。
//      實作仍在 shared/healthCheck.ts（與健檢里程碑引擎同住），此處再匯出成統一門面。
//
// 分類函式皆為「純函式」，以 YYYY-MM-DD 字串計算整日差，不依賴時區設定；
// 需要「今天」時由呼叫端注入（見 todayInTaipei 為邊界便利函式）。

/** 固定期限分級（60 / 120 天）——實作在 healthCheck，此處統一對外門面。 */
export { classifyDeadline, type DeadlineResult } from "@shared/healthCheck";

const DAY_MS = 86400000;

/** 解析 YYYY-MM-DD（取前 10 字）為 UTC 午夜時間戳；非法回 NaN。 */
function parseYmd(s: string): number {
  const head = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return NaN;
  return Date.parse(head + "T00:00:00Z");
}

/**
 * 距到期天數（整日）：正數＝還有幾天到期，0＝今日到期，負數＝已過期幾天。
 * 兩參數皆為 YYYY-MM-DD；以 UTC 曆計算，與時區無關（呼叫端負責提供台北的「今天」）。
 * 任一非法回 NaN。
 */
export function daysUntil(dueDate: string, today: string): number {
  const a = parseYmd(today);
  const b = parseYmd(dueDate);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((b - a) / DAY_MS);
}

/** 台北時區的「今天」YYYY-MM-DD（邊界便利函式；讀系統時鐘）。 */
export function todayInTaipei(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(
    new Date()
  );
}

// ─── 證件／文件上色分段（5 段）────────────────────────────────────────────────
//   已過期 → expired；14 天內 → critical；30 天內 → warning；90 天內 → notice；其餘 → ok
export type ExpiryTier = "expired" | "critical" | "warning" | "notice" | "ok";

export function expiryTier(days: number): ExpiryTier {
  if (days < 0) return "expired";
  if (days <= 14) return "critical";
  if (days <= 30) return "warning";
  if (days <= 90) return "notice";
  return "ok";
}

/** 剩餘天數文字（如「已過期 3 天」／「今日到期」／「剩 12 天」）。 */
export function expiryLabel(days: number): string {
  if (days < 0) return `已過期 ${Math.abs(days)} 天`;
  if (days === 0) return "今日到期";
  return `剩 ${days} 天`;
}

/** 是否屬「需要警示」的緊迫程度（30 天內或已過期）。 */
export function isExpiryUrgent(days: number): boolean {
  const t = expiryTier(days);
  return t === "expired" || t === "critical" || t === "warning";
}
