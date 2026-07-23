/**
 * 媒合標的統一解析——共用型別（前後端共用）。
 *
 * 把內部資料實際解讀成摘要的邏輯（會讀 DB）在 server/matchTarget.ts。
 * 依據：docs/feature-match-target.md。
 */
import type { JobCategory } from "@shared/publicView";

/**
 * 一筆媒合意向指向什麼的「去識別摘要」——四種標的（職缺／需求單／移工／開放諮詢）
 * 都正規化成同一形狀。呼叫端只讀這個，不再判斷 targetType、不碰 inquiry* 欄位、
 * 不知道 targetId=0 暗號。
 */
export type MatchTargetSummary = {
  /** 具體職類（真標的的 qual）；開放諮詢為 null。 */
  jobType: string | null;
  /** 三桶分類：真標的＝jobCategory(jobType)；開放諮詢＝inquiryCategory 原值（含 unsure）。 */
  category: JobCategory | "unsure" | null;
  /** 縣市（移工標的借「可上工時間」）。 */
  city: string | null;
  /** 給客服佇列的標籤。 */
  label: string;
};
