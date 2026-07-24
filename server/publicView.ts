/**
 * 對外資料出口——唯一能把內部資料（含 PII）轉成「對外版」並蓋章的地方。
 *
 * 規約：本檔案是唯一允許出現 `as Public*` 強制轉型之處（見 scripts/check-conventions.mjs）。
 * 所有對外 tRPC procedure 一律回傳這裡產出的蓋章型別，直接回原始 row 會編譯失敗。
 *
 * 依據：docs/feature-public-view.md、docs/marketplace-platform-spec.md §11。
 */
import type {
  Worker,
  Customer,
  JobPosting,
  WorkerPublicProfile,
} from "../drizzle/schema";
import {
  jobCategory,
  type MarketplaceQualType,
  type PublicEmployerType,
  type PublicProfile,
  type PublicWorkerCard,
  type PublicListingCard,
  type PublicListingDetail,
} from "@shared/publicView";

/** 評分達此則數才對外顯示（門檻；見 docs/feature-ratings.md）。 */
const RATING_MIN_COUNT = 5;

/**
 * 需求單卡／詳情所需的最小欄位——同時相容 db.listPublicOpenDemands 的精簡投影
 * 與完整 CaseDemand row（後者由 getDemandById 取得）。刻意不吃整個 CaseDemand，
 * 讓「列表投影」與「詳情完整 row」都能直接傳入。
 */
export type PublicDemandSource = {
  id: number;
  qualType: MarketplaceQualType;
  neededCount: number;
  publicCity: string | null;
  createdAt: Date | null;
  // 需求單 P1 對外欄位（皆選填；未提供則對外為 null）。
  label?: string | null; // 職稱
  employerDisplayName?: string | null; // 雇主對外顯示名稱（去識別代稱）
  district?: string | null;
  employmentType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  expectedStartDate?: string | null;
  requirements?: string | null;
  publicDescription?: string | null;
  notesForSeeker?: string | null; // 僅登入求職者可見（見 toPublicDemandDetail 的 includeSeekerNotes）
};

// ─── 內部小工具 ─────────────────────────────────────────────────────────────
/** 安全解析 JSON 陣列欄位（skills/languages/jobTypes/preferredCities），壞資料一律回空陣列。 */
function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(x => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** 出生年 → 年齡區間（5 歲一段，去識別，不露精確生日）。今年由伺服器時鐘取得。 */
function ageRangeFromYear(year: number | null | undefined): string | null {
  if (!year || year < 1900) return null;
  const now = new Date().getFullYear();
  const age = now - year;
  if (age < 0 || age > 120) return null;
  const lo = Math.floor(age / 5) * 5;
  return `${lo}–${lo + 4}`;
}

// ─── 對外版轉換（唯一蓋章點）───────────────────────────────────────────────────
/** 移工履歷（完整 row，含 PII）→ 對外匿名履歷。 */
export function toPublicProfile(row: WorkerPublicProfile): PublicProfile {
  const ratingCount = row.ratingCount ?? 0;
  // 期望職類可多選：優先讀 jobTypes（JSON 陣列），無則回退到單值 jobType。
  const parsedTypes = parseJsonArray(row.jobTypes);
  const jobTypes =
    parsedTypes.length > 0 ? parsedTypes : row.jobType ? [row.jobType] : [];
  const primary = jobTypes[0] ?? null;
  return {
    id: row.id,
    alias: row.alias || `外籍工作者 #${row.id}`,
    headline: row.headline,
    nationality: row.nationality,
    ageRange: ageRangeFromYear(row.yearOfBirth),
    jobType: primary, // 主要職類（供頭像/相容）
    jobTypes, // 全部期望職類（多選）
    category: primary ? jobCategory(primary as MarketplaceQualType) : null,
    skills: parseJsonArray(row.skills),
    languages: parseJsonArray(row.languages),
    preferredCities: parseJsonArray(row.preferredCities),
    availability: row.availability,
    // 公開層只給「有無真實照片」布林，實際照片一律登入後才下傳（維持去識別）。
    hasPhoto: !!row.photoKey,
    // 未達門檻不外露任何評分數字；達門檻才給平均分（×1/10 還原）與則數。
    rating:
      ratingCount >= RATING_MIN_COUNT
        ? { avg: (row.ratingAvg ?? 0) / 10, count: ratingCount }
        : null,
  } as PublicProfile;
}

/** 移工履歷 → 找移工列表卡（現階段與履歷同型的去識別子集）。 */
export function toPublicWorkerCard(row: WorkerPublicProfile): PublicWorkerCard {
  return toPublicProfile(row);
}

/** 雇主（完整 row，含 PII）→ 只回「個人／公司」；無從判斷則 null（供詳情內嵌）。 */
export function toPublicEmployerType(
  customer: Customer | null | undefined
): PublicEmployerType | null {
  const type = customer?.employerType;
  if (type !== "individual" && type !== "company") return null;
  return type;
}

/** 自助雇主職缺（完整 row，含 employerUserId/customerId）→ 對外職缺卡。 */
export function toPublicJobCard(row: JobPosting): PublicListingCard {
  return {
    source: "posting",
    refId: row.id,
    title: null, // 職缺目前無獨立職稱欄
    employerDisplayName: null, // 卡片層不撈雇主；顯示名稱於詳情層帶出
    category: jobCategory(row.jobType as MarketplaceQualType),
    jobType: row.jobType,
    city: row.city,
    district: row.district,
    employmentType: row.employmentType,
    headcount: row.headcount,
    publicDescription: row.publicDescription,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    postedAt: (row.publishedAt ?? row.createdAt)?.toISOString() ?? null,
  } as PublicListingCard;
}

/** 既有需求單（投影或完整 row，可能含 caseId）→ 對外需求單卡。 */
export function toPublicDemandCard(row: PublicDemandSource): PublicListingCard {
  return {
    source: "demand",
    refId: row.id,
    title: row.label ?? null, // 職稱沿用 label
    employerDisplayName: row.employerDisplayName ?? null, // 去識別代稱
    category: jobCategory(row.qualType as MarketplaceQualType),
    jobType: row.qualType,
    city: row.publicCity,
    district: row.district ?? null,
    employmentType: row.employmentType ?? null,
    headcount: row.neededCount,
    publicDescription: row.publicDescription ?? null,
    salaryMin: row.salaryMin ?? null,
    salaryMax: row.salaryMax ?? null,
    postedAt: row.createdAt?.toISOString() ?? null,
  } as PublicListingCard;
}

/** 自助雇主職缺（完整 row）＋雇主 row → 對外職缺詳情（雇主只露類型/代稱）。 */
export function toPublicJobDetail(
  row: JobPosting,
  employer: Customer | null | undefined
): PublicListingDetail {
  return {
    source: "posting",
    refId: row.id,
    title: null,
    employerDisplayName: employer?.publicDisplayName ?? null,
    category: jobCategory(row.jobType as MarketplaceQualType),
    jobType: row.jobType,
    city: row.city,
    district: row.district,
    employmentType: row.employmentType,
    employerType: toPublicEmployerType(employer),
    headcount: row.headcount,
    requirements: row.requirements,
    publicDescription: row.publicDescription,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    expectedStartDate: row.expectedStartDate,
    notesForSeeker: null, // 職缺無求職者備註
    postedAt: (row.publishedAt ?? row.createdAt)?.toISOString() ?? null,
  } as PublicListingDetail;
}

/**
 * 既有需求單（投影或完整 row）＋雇主 row → 對外職缺詳情（雇主只露類型/代稱）。
 * notesForSeeker 僅在 includeSeekerNotes=true（登入求職者）時帶出，否則 null。
 */
export function toPublicDemandDetail(
  row: PublicDemandSource,
  employer: Customer | null | undefined,
  opts: { includeSeekerNotes?: boolean } = {}
): PublicListingDetail {
  return {
    source: "demand",
    refId: row.id,
    title: row.label ?? null,
    employerDisplayName:
      employer?.publicDisplayName ?? row.employerDisplayName ?? null,
    category: jobCategory(row.qualType as MarketplaceQualType),
    jobType: row.qualType,
    city: row.publicCity,
    district: row.district ?? null,
    employmentType: row.employmentType ?? null,
    employerType: toPublicEmployerType(employer),
    headcount: row.neededCount,
    requirements: row.requirements ?? null,
    publicDescription: row.publicDescription ?? null,
    salaryMin: row.salaryMin ?? null,
    salaryMax: row.salaryMax ?? null,
    expectedStartDate: row.expectedStartDate ?? null,
    notesForSeeker: opts.includeSeekerNotes
      ? (row.notesForSeeker ?? null)
      : null,
    postedAt: row.createdAt?.toISOString() ?? null,
  } as PublicListingDetail;
}

// Worker 型別先保留匯入以備列表卡帶平台驗證紀錄時使用（避免實作階段又改 import）。
export type { Worker };
