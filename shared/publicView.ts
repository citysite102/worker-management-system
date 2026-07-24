/**
 * 對外資料出口——共用型別與黑名單（前後端共用）。
 *
 * 這裡只放「型別」與「純資料」；把內部資料實際轉成對外版的邏輯（會讀到 PII）
 * 一律在 server/publicView.ts，且那裡是唯一能「蓋章」產出下列型別的地方。
 *
 * 依據：docs/feature-public-view.md、docs/marketplace-platform-spec.md §11。
 */

// ─── 蓋章型別 ───────────────────────────────────────────────────────────────
// publicBrand 不匯出：外部模組無法命名此鍵，因此無法自行合成蓋章值——
// 唯一產出方式是在 server/publicView.ts 內以強制轉型「蓋章」（規約檢查禁止他處轉型）。
declare const publicBrand: unique symbol;
/** 蓋了「對外」私章的型別；所有對外接口一律回傳此型別。 */
export type Public<T> = T & { readonly [publicBrand]: "public" };

// ─── 職類分桶（純函式，前後端共用）─────────────────────────────────────────────
export type MarketplaceQualType =
  | "caregiver"
  | "domestic_helper"
  | "manufacturing"
  | "agriculture"
  | "construction"
  | "white_collar"
  | "intermediate"
  | "overseas_student";

/** 公開站三桶職類：看護 / 房務 / 其他。 */
export type JobCategory = "caregiver" | "domestic_helper" | "other";

export function jobCategory(qualType: MarketplaceQualType): JobCategory {
  if (qualType === "caregiver") return "caregiver";
  if (qualType === "domestic_helper") return "domestic_helper";
  return "other";
}

// ─── 對外版資料形狀（皆為蓋章型別）──────────────────────────────────────────────
/** 移工匿名履歷（對外）。id 為履歷 id，非移工 id。 */
/** 移工匿名履歷的去識別欄位（未蓋章版；供 PublicProfile 與 PublicProfileDetail 共用）。 */
export type PublicProfileFields = {
  id: number;
  alias: string;
  headline: string | null;
  nationality: string | null;
  /** 年齡區間（5 歲一段），不露精確生日。 */
  ageRange: string | null;
  jobType: string | null;
  jobTypes: string[];
  category: JobCategory | null;
  skills: string[];
  languages: string[];
  preferredCities: string[];
  availability: string | null;
  /** 只給「有沒有真實照片」；實際照片登入後才下傳。 */
  hasPhoto: boolean;
  /** 未達門檻一律 null；達門檻才給平均分與則數。 */
  rating: { avg: number; count: number } | null;
};

export type PublicProfile = Public<PublicProfileFields>;

/** 找移工列表卡——現階段與履歷同型（列表與詳情回傳一致的去識別子集）。 */
export type PublicWorkerCard = PublicProfile;

/** 平台驗證聘僱紀錄（去識別；只露職務/期間/狀態，不含雇主或案件連結）。 */
export type PublicPlatformRecord = {
  id: number;
  position: string | null;
  contractStart: string | null;
  contractEnd: string | null;
  status: string;
};

/** 移工自填經歷（去識別公開子集）。 */
export type PublicWorkerExperience = {
  id: number;
  employerType: string;
  role: string;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
};

/**
 * 移工履歷「詳情」（對外）——去識別底稿 ＋ 登入後才揭露的受控欄位。
 * selfIntro / photoUrl / 經歷 / 平台紀錄一律登入後才有值（gated=false）；未登入為佔位空值。
 * 明訂為蓋章型別，讓 findWorkers.get 回原始 row 會編譯失敗。
 */
export type PublicProfileDetail = Public<
  PublicProfileFields & {
    gated: boolean;
    selfIntro: string | null;
    photoUrl: string | null;
    platformRecords: PublicPlatformRecord[];
    experiences: PublicWorkerExperience[];
  }
>;

/** 去識別雇主線索：只回「個人／公司」，其餘一律不給（純字串，供詳情內嵌）。 */
export type PublicEmployerType = "individual" | "company";

/** 職缺／需求單卡（對外）——posting 與 demand 共用同一形狀。 */
export type PublicListingCard = Public<{
  source: "posting" | "demand";
  refId: number;
  /** 職稱（需求單取自 label；職缺目前無獨立職稱）。 */
  title: string | null;
  /** 雇主對外顯示名稱（去識別代稱）；永不為真名。 */
  employerDisplayName: string | null;
  category: JobCategory;
  jobType: string;
  city: string | null;
  district: string | null;
  employmentType: string | null;
  headcount: number;
  publicDescription: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  postedAt: string | null;
}>;

/** 職缺／需求單「詳情」（對外）——比列表卡多 requirements/expectedStartDate/去識別雇主類型/求職者備註。 */
export type PublicListingDetail = Public<{
  source: "posting" | "demand";
  refId: number;
  title: string | null;
  employerDisplayName: string | null;
  category: JobCategory;
  jobType: string;
  city: string | null;
  district: string | null;
  employmentType: string | null;
  employerType: PublicEmployerType | null;
  headcount: number;
  requirements: string | null;
  publicDescription: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  expectedStartDate: string | null;
  /** 案件情況備註(求職者用)：僅登入求職者/應徵者可見；未登入為 null。 */
  notesForSeeker: string | null;
  postedAt: string | null;
}>;

// ─── 守門黑名單（依 §11.1）──────────────────────────────────────────────────
/**
 * 這些欄位名稱絕不得出現在任何對外版資料中（含巢狀）。
 * 守門測試與（未來的）規約檢查共用同一份，避免兩處漂移。
 */
export const PUBLIC_PII_DENYLIST = [
  // 反查連結
  "userId",
  "workerId",
  "customerId",
  "caseId",
  "employerUserId",
  // 姓名
  "name",
  "nameCn",
  "nameEn",
  "contactName",
  "careReceiverName",
  // 證件號（移工 + 雇主/被照顧者；idNo 為 customers 實際欄位名，非 idNumber）
  "residentPermitNo",
  "passportNo",
  "idNo",
  "idNumber",
  "careReceiverIdNo",
  "taxId",
  "employerNo",
  "careReceiverNo",
  "caseNo",
  "preCourseNo",
  // 證件影像／照片檔／文件檔（S3 key）
  "photoKey",
  "passportKey",
  "residentPermitFrontKey",
  "residentPermitBackKey",
  "passportEntryKey",
  "idFrontKey",
  "idBackKey",
  "careReceiverIdFrontKey",
  "careReceiverIdBackKey",
  "jobSeekerFileKey",
  "recruitmentLetterFileKey",
  "employmentLetterFileKey",
  // 聯絡與地址
  "phone",
  "landline",
  "contactPhone",
  "address",
  "registeredAddress",
  "careReceiverAddress",
  "referrer",
  // 精確日期／健檢
  "birthDate",
  "yearOfBirth",
  "careReceiverBirthDate",
  "lastMedicalExamDate",
  "nextMedicalExamType",
  // 反查連結（承辦業務）
  "managerId",
  // 自由文字（登入後才給）
  "selfIntro",
  // 需求單內部/機密欄位（永不外露；守門回歸網）
  "actualExpectedStartDate",
  "notesForApplicant",
] as const;

export type PublicPiiKey = (typeof PUBLIC_PII_DENYLIST)[number];
