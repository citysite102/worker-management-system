// ─── 到期色彩規則（統一 4 段）──────────────────────────────────────────────
// 全站證件/文件「距到期天數」一律用這裡的分段與配色，避免各頁各自為政。
//   已過期        → expired  紅
//   14 天內       → critical 橙紅
//   30 天內       → warning  橙
//   90 天內       → notice   黃
//   其餘          → ok       灰（通常不特別標示）

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

/** 徽章（pill）樣式，供儀表板等清單使用。 */
export const EXPIRY_PILL_CLASS: Record<ExpiryTier, string> = {
  expired: "status-red",
  critical: "bg-red-50 text-red-600 border border-red-200",
  warning: "status-amber",
  notice: "bg-amber-50 text-amber-600 border border-amber-200",
  ok: "status-gray",
};

/** 內嵌文字樣式，供列表就地標色使用。 */
export const EXPIRY_TEXT_CLASS: Record<ExpiryTier, string> = {
  expired: "text-red-600 font-medium",
  critical: "text-red-500 font-medium",
  warning: "text-orange-500 font-medium",
  notice: "text-amber-500 font-medium",
  ok: "text-muted-foreground",
};

/** 是否屬「需要警示」的緊迫程度（30 天內或已過期）。 */
export function isExpiryUrgent(days: number): boolean {
  const t = expiryTier(days);
  return t === "expired" || t === "critical" || t === "warning";
}
