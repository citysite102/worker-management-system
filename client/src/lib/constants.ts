// ─── 移工：生命週期狀態 ───────────────────────────────────────────────────────
export const LIFECYCLE_STATUS_OPTIONS = [
  { value: "recruiting", label: "招募中" },
  { value: "document_processing", label: "文件辦理" },
  { value: "employed", label: "在職" },
  { value: "pending_renewal", label: "待續聘" },
  { value: "departed", label: "已離境" },
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUS_OPTIONS)[number]["value"];

// ─── 移工：文件狀態 ───────────────────────────────────────────────────────────
export const DOCUMENT_STATUS_OPTIONS = [
  { value: "not_started", label: "未啟動" },
  { value: "pending_supplement", label: "待補件" },
  { value: "expiring_soon", label: "即將到期" },
  { value: "complete", label: "完備" },
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUS_OPTIONS)[number]["value"];

// ─── 客戶：雇主類型 ───────────────────────────────────────────────────────────
export const EMPLOYER_TYPE_OPTIONS = [
  { value: "individual", label: "個人雇主" },
  { value: "company", label: "公司行號" },
] as const;

export type EmployerType = (typeof EMPLOYER_TYPE_OPTIONS)[number]["value"];

// ─── 客戶：合約狀態 ───────────────────────────────────────────────────────────
export const CONTRACT_STATUS_OPTIONS = [
  { value: "negotiating", label: "洽談中" },
  { value: "signed", label: "已簽約" },
  { value: "in_service", label: "服務中" },
  { value: "pending_renewal", label: "待續約" },
  { value: "ended", label: "已結束" },
] as const;

export type ContractStatus = (typeof CONTRACT_STATUS_OPTIONS)[number]["value"];

// ─── 客戶：定價級距 ───────────────────────────────────────────────────────────
export const PRICING_TIER_OPTIONS = [
  { value: "standard", label: "標準" },
  { value: "custom", label: "客製" },
] as const;

export type PricingTier = (typeof PRICING_TIER_OPTIONS)[number]["value"];

// ─── 客戶：媒合案件狀態 ───────────────────────────────────────────────────────
export const CASE_STATUS_OPTIONS = [
  { value: "pending", label: "待處理" },
  { value: "processing", label: "處理中" },
  { value: "matched", label: "已媒合" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
] as const;

export type CaseStatus = (typeof CASE_STATUS_OPTIONS)[number]["value"];

// ─── 客戶：求才類別 ───────────────────────────────────────────────────────────
export const JOB_SEEKER_TYPE_OPTIONS = [
  { value: "new_hire", label: "新聘" },
  { value: "renewal", label: "續聘" },
  { value: "transfer", label: "轉換雇主" },
  { value: "supplement", label: "補件" },
] as const;

export type JobSeekerType = (typeof JOB_SEEKER_TYPE_OPTIONS)[number]["value"];

// ─── 客戶：招募函類別 ─────────────────────────────────────────────────────────
export const RECRUITMENT_LETTER_TYPE_OPTIONS = [
  { value: "domestic", label: "國內招募" },
  { value: "overseas", label: "國外招募" },
  { value: "both", label: "國內外" },
] as const;

export type RecruitmentLetterType = (typeof RECRUITMENT_LETTER_TYPE_OPTIONS)[number]["value"];

// ─── 客戶：聘僱函類別 ─────────────────────────────────────────────────────────
export const EMPLOYMENT_LETTER_TYPE_OPTIONS = [
  { value: "initial", label: "初次聘僱" },
  { value: "renewal", label: "續聘" },
  { value: "transfer", label: "轉換" },
] as const;

export type EmploymentLetterType = (typeof EMPLOYMENT_LETTER_TYPE_OPTIONS)[number]["value"];

// ─── 案件管理：案件狀態 ──────────────────────────────────────────────────────
export const CASE_MGMT_STATUS_OPTIONS = [
  { value: "in_progress", label: "進行中" },
  { value: "completed",   label: "已完成" },
  { value: "paused",      label: "暫停" },
  { value: "cancelled",   label: "取消" },
] as const;
export type CaseMgmtStatus = (typeof CASE_MGMT_STATUS_OPTIONS)[number]["value"];

export const QUAL_CATEGORY_OPTIONS = [
  { value: "labor_in",     label: "勞基法內" },
  { value: "labor_out",    label: "勞基法外" },
  { value: "professional", label: "專業/評點" },
] as const;
export type QualCategory = (typeof QUAL_CATEGORY_OPTIONS)[number]["value"];

export const QUAL_TYPE_OPTIONS = [
  { value: "caregiver",        label: "看護" },
  { value: "domestic_helper",  label: "幫傭" },
  { value: "manufacturing",    label: "製造業" },
  { value: "agriculture",      label: "農業" },
  { value: "construction",     label: "營造業" },
  { value: "white_collar",     label: "白領" },
  { value: "intermediate",     label: "中階技術" },
  { value: "overseas_student", label: "評點制僑外生" },
] as const;
export type QualType = (typeof QUAL_TYPE_OPTIONS)[number]["value"];

export const APPLICATION_STATUS_OPTIONS = [
  { value: "preparing",  label: "準備中" },
  { value: "submitted",  label: "已送件" },
  { value: "reviewing",  label: "審核中" },
  { value: "approved",   label: "已核准" },
  { value: "supplement", label: "補件中" },
  { value: "rejected",   label: "已退件" },
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUS_OPTIONS)[number]["value"];

export const DEMAND_STATUS_OPTIONS = [
  { value: "open",      label: "開放中" },
  { value: "filling",   label: "媒合中" },
  { value: "fulfilled", label: "已媒合滿" },
  { value: "closed",    label: "已關閉" },
] as const;
export type DemandStatus = (typeof DEMAND_STATUS_OPTIONS)[number]["value"];

export const ASSIGNMENT_STAGE_OPTIONS = [
  { value: "candidate", label: "人選評估" },
  { value: "confirmed", label: "已確認" },
  { value: "upcoming",  label: "即將聘僱" },
  { value: "employed",  label: "聘僱中" },
  { value: "departed",  label: "已離職" },
  { value: "rejected",  label: "婉拒/未錄取" },
] as const;
export type AssignmentStage = (typeof ASSIGNMENT_STAGE_OPTIONS)[number]["value"];

// ─── 證件類型 ─────────────────────────────────────────────────────────────────
export const ID_TYPE_OPTIONS = [
  { value: "resident_permit", label: "居留證" },
  { value: "passport", label: "護照" },
] as const;

export type IdType = (typeof ID_TYPE_OPTIONS)[number]["value"];

// ─── 狀態配色映射 ─────────────────────────────────────────────────────────────
export type StatusColor = "green" | "amber" | "red" | "gray" | "blue";

const STATUS_COLOR_MAP: Record<string, StatusColor> = {
  // 綠色
  employed: "green",
  in_service: "green",
  signed: "green",
  complete: "green",
  matched: "green",
  completed: "green",
  // 琥珀色
  recruiting: "amber",
  document_processing: "amber",
  negotiating: "amber",
  pending_renewal: "amber",
  expiring_soon: "amber",
  processing: "amber",
  // 紅色
  pending_supplement: "red",
  cancelled: "red",
  rejected: "red",
  // 藍色
  pending: "blue",
  // 灰色
  not_started: "gray",
  departed: "gray",
  ended: "gray",
  // 案件管理
  in_progress: "blue",
  paused: "gray",
  // 資格申請
  preparing: "gray",
  submitted: "blue",
  reviewing: "amber",
  approved: "green",
  supplement: "amber",
  // 需求
  open: "blue",
  filling: "amber",
  fulfilled: "green",
  closed: "gray",
  // 配對成員
  candidate: "gray",
  confirmed: "blue",
  upcoming: "amber",
};

export function getStatusColor(status: string): StatusColor {
  return STATUS_COLOR_MAP[status] ?? "gray";
}

// ─── 所有標籤映射 ─────────────────────────────────────────────────────────────
const ALL_LABELS: Record<string, string> = {
  ...Object.fromEntries(LIFECYCLE_STATUS_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(DOCUMENT_STATUS_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(EMPLOYER_TYPE_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(CONTRACT_STATUS_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(PRICING_TIER_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(CASE_STATUS_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(JOB_SEEKER_TYPE_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(RECRUITMENT_LETTER_TYPE_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(EMPLOYMENT_LETTER_TYPE_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(ID_TYPE_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(CASE_MGMT_STATUS_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(QUAL_CATEGORY_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(QUAL_TYPE_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(APPLICATION_STATUS_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(DEMAND_STATUS_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(ASSIGNMENT_STAGE_OPTIONS.map(o => [o.value, o.label])),
};

export function getStatusLabel(value: string): string {
  return ALL_LABELS[value] ?? value;
}

// ─── 國籍選項（含國碼）────────────────────────────────────────────────────────
export const NATIONALITY_OPTIONS = [
  { value: "印尼", label: "印尼（009）" },
  { value: "越南", label: "越南（084）" },
  { value: "菲律賓", label: "菲律賓（608）" },
  { value: "泰國", label: "泰國（764）" },
  { value: "緬甸", label: "緬甸（104）" },
  { value: "印度", label: "印度（356）" },
  { value: "孟加拉", label: "孟加拉（050）" },
  { value: "other", label: "其他" },
] as const;
