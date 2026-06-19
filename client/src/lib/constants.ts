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

// ─── 證件類型 ─────────────────────────────────────────────────────────────────
export const ID_TYPE_OPTIONS = [
  { value: "resident_permit", label: "居留證" },
  { value: "passport", label: "護照" },
] as const;

export type IdType = (typeof ID_TYPE_OPTIONS)[number]["value"];

// ─── 狀態配色映射 ─────────────────────────────────────────────────────────────
export type StatusColor = "green" | "amber" | "red" | "gray";

const STATUS_COLOR_MAP: Record<string, StatusColor> = {
  // 綠色
  employed: "green",
  in_service: "green",
  signed: "green",
  complete: "green",
  // 琥珀色
  recruiting: "amber",
  document_processing: "amber",
  negotiating: "amber",
  pending_renewal: "amber",
  expiring_soon: "amber",
  // 紅色
  pending_supplement: "red",
  // 灰色
  not_started: "gray",
  departed: "gray",
  ended: "gray",
};

export function getStatusColor(status: string): StatusColor {
  return STATUS_COLOR_MAP[status] ?? "gray";
}

// ─── 所有標籤映射 ─────────────────────────────────────────────────────────────
const ALL_LABELS: Record<string, string> = {
  ...Object.fromEntries(LIFECYCLE_STATUS_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(DOCUMENT_STATUS_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(CONTRACT_STATUS_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(PRICING_TIER_OPTIONS.map(o => [o.value, o.label])),
  ...Object.fromEntries(ID_TYPE_OPTIONS.map(o => [o.value, o.label])),
};

export function getStatusLabel(value: string): string {
  return ALL_LABELS[value] ?? value;
}
