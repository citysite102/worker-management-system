// ─── 到期色彩（前端配色轉接層）────────────────────────────────────────────────
// 分段與判定邏輯一律來自 shared/expiry.ts（server / client 單一來源）；
// 這裡只負責把分段對應到 Tailwind 樣式（純前端呈現），並沿用原有匯入路徑。

export {
  type ExpiryTier,
  expiryTier,
  expiryLabel,
  isExpiryUrgent,
  daysUntil,
  todayInTaipei,
} from "@shared/expiry";

import type { ExpiryTier } from "@shared/expiry";

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
