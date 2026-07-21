// ─── 公開媒合平台：結構化選項（P1）────────────────────────────────────────────
// 職類/職種/聘僱型態為結構化欄位，顯示文字一律走 i18n key（規格 §7.6），
// 這裡只放「值清單」與純邏輯，供公開站與雇主表單共用。

/** 台灣縣市（公開需求單地點選單；縣市層級，不含精確地址）。 */
export const TW_CITIES = [
  "臺北市",
  "新北市",
  "桃園市",
  "臺中市",
  "臺南市",
  "高雄市",
  "基隆市",
  "新竹市",
  "新竹縣",
  "苗栗縣",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "屏東縣",
  "宜蘭縣",
  "花蓮縣",
  "臺東縣",
  "澎湖縣",
  "金門縣",
  "連江縣",
] as const;

/** 內部職類（對應 case_qualifications.qualType / job_postings.jobType）。 */
export const JOB_TYPE_VALUES = [
  "caregiver",
  "domestic_helper",
  "manufacturing",
  "agriculture",
  "construction",
  "white_collar",
  "intermediate",
  "overseas_student",
] as const;
export type JobTypeValue = (typeof JOB_TYPE_VALUES)[number];

/** 公開站三桶職類：看護 / 房務 / 其他。 */
export const JOB_CATEGORY_VALUES = [
  "caregiver",
  "domestic_helper",
  "other",
] as const;
export type JobCategory = (typeof JOB_CATEGORY_VALUES)[number];

/** 聘僱型態。 */
export const EMPLOYMENT_TYPE_VALUES = [
  "live_in",
  "live_out",
  "institution",
  "other",
] as const;
export type EmploymentTypeValue = (typeof EMPLOYMENT_TYPE_VALUES)[number];

/** 退件理由代碼（審核後台用；與後端 moderation.rejectPosting 對齊）。 */
export const REJECT_REASON_VALUES = [
  "incomplete",
  "illegal_content",
  "illegal_terms",
  "duplicate",
  "other",
] as const;
export type RejectReasonValue = (typeof REJECT_REASON_VALUES)[number];

/** 需求單狀態（雇主端顯示）。 */
export const POSTING_STATUS_VALUES = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "paused",
  "filled",
  "closed",
] as const;
export type PostingStatusValue = (typeof POSTING_STATUS_VALUES)[number];

/** 職類 → 公開站三桶分類。 */
export function jobCategoryOf(jobType: JobTypeValue): JobCategory {
  if (jobType === "caregiver") return "caregiver";
  if (jobType === "domestic_helper") return "domestic_helper";
  return "other";
}

/** 薪資區間顯示（純數字格式化；文案由呼叫端補）。 */
export function formatSalary(
  min: number | null,
  max: number | null
): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) => `NT$${n.toLocaleString("en-US")}`;
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  return `≤ ${fmt(max as number)}`;
}
