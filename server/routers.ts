import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  publicProcedure,
  protectedProcedure,
  staffProcedure,
  employerProcedure,
  workerProcedure,
  router,
} from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getAllManagers,
  createManager,
  deleteManager,
  countDependentsByManager,
  getAllWorkers,
  getWorkerById,
  getWorkerByPermitNo,
  getWorkerByPassportNo,
  createWorker,
  updateWorker,
  deleteWorker,
  getAllCustomers,
  getCustomerById,
  getCustomerByTaxId,
  getCustomerByName,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  countCasesByCustomer,
  getAllCases,
  getCaseById,
  createCase,
  updateCase,
  deleteCase,
  getCaseChildCounts,
  getQualificationsByCaseId,
  getQualificationById,
  createQualification,
  updateQualification,
  deleteQualification,
  getQuotaUsed,
  getDemandsByCaseId,
  getDemandById,
  createDemand,
  updateDemand,
  deleteDemand,
  getDemandProgressBatch,
  getAssignmentsByCaseId,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getMembersByCaseId,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
  getWorkerInvolvements,
  getCaseDimensions,
  getCaseDimensionsBatch,
  getQuotaUsedBatch,
  getEmploymentsByCase,
  createEmployment,
  updateEmployment,
  deleteEmployment,
  getCareReceiversByCustomerId,
  createCareReceiver,
  updateCareReceiver,
  deleteCareReceiver,
  getQualificationsByCustomerId,
  createCustomerQualification,
  updateCustomerQualification,
  deleteCustomerQualification,
  getDashboardCounts,
  getExpiryCandidateWorkers,
  upsertKpiSnapshot,
  getPreviousKpiSnapshot,
  getComplianceCandidates,
  getUserById,
  createJobPosting,
  getJobPostingById,
  getJobPostingsByEmployer,
  updateJobPosting,
  getPendingJobPostings,
  claimJobPostingForApproval,
  listApprovedJobPostings,
  listPublicOpenDemands,
  setDemandPublicHidden,
  setCasePublicCity,
  insertModerationEvent,
  createMatchRequest,
  getOpenMatchRequest,
  getAllMatchRequests,
  getMatchRequestById,
  updateMatchRequest,
  getMatchRequestsByInitiator,
  getProfileByUserId,
  getProfileById,
  createProfile,
  updateProfile,
  getPendingProfiles,
  listPublicProfiles,
  getExperiencesByUserId,
  getApprovedExperiencesByUserId,
  getExperienceById,
  createExperience,
  updateExperience,
  deleteExperience,
  getPendingExperiences,
  getEmploymentsByWorker,
  countApprovedPostingsByEmployer,
  getAllProfiles,
  searchWorkersForReconcile,
  setProfileWorkerLink,
} from "./db";
import {
  evaluateHealthChecks,
  isActionableStatus,
  statusRank,
  milestoneLabel,
  classifyDeadline,
  addMonthsYmd,
  type HealthCheckStatus,
} from "@shared/healthCheck";
import { storagePut } from "./storage";
import { logAudit } from "./_core/audit";
import { getUserByEmail, createUser } from "./db";
import { hashPassword, verifyPassword } from "./_core/auth/password";
import { issueSession, newLocalOpenId } from "./_core/auth/session";
import {
  validateTwPhone,
  normalizePhone,
  validateResidentPermit,
  validatePassport,
  validateTaxId,
  validateNotFutureDate,
} from "../shared/validation";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const workerInput = z.object({
  // 基本資料
  name: z.string().trim().min(1, "姓名為必填").max(100),
  workerNo: z
    .string()
    .max(50)
    .optional()
    .transform(s => s?.trim() || undefined),
  nameEn: z
    .string()
    .max(100)
    .optional()
    .transform(s => s?.trim() || undefined),
  nameCn: z
    .string()
    .max(50)
    .optional()
    .transform(s => s?.trim() || undefined),
  birthDate: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  gender: z.enum(["male", "female", "other"]).optional(),
  nationality: z
    .string()
    .max(50)
    .optional()
    .transform(s => s?.trim() || undefined),
  birthPlace: z
    .string()
    .max(100)
    .optional()
    .transform(s => s?.trim() || undefined),
  occupation: z
    .enum([
      "caregiver_family",
      "caregiver_hospital",
      "manufacturing",
      "construction",
      "agriculture",
      "fishery",
      "other",
    ])
    .optional(),
  // 狀態
  lifecycleStatus: z.enum([
    "employed",
    "idle_in_tw",
    "preparing_abroad",
    "returned",
    "absconded",
  ]),
  documentStatus: z.enum([
    "not_started",
    "pending_supplement",
    "expiring_soon",
    "complete",
  ]),
  managerId: z.number().int().positive("負責人為必填"),
  // 證件
  residentPermitNo: z
    .string()
    .max(30)
    .optional()
    .transform(s => s?.trim() || undefined),
  residentPermitExpiry: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  passportNo: z
    .string()
    .max(30)
    .optional()
    .transform(s => s?.trim() || undefined),
  passportExpiry: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  entryDate: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  // 聯絡
  phone: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  email: z
    .string()
    .max(200)
    .optional()
    .transform(s => s?.trim() || undefined),
  // 體檢
  lastMedicalExamDate: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  nextMedicalExamType: z
    .enum(["6_month", "annual", "pre_entry", "other"])
    .optional(),
  // 附件 S3 keys（由上傳 API 回傳後存入）
  photoKey: z
    .string()
    .max(300)
    .optional()
    .transform(s => s?.trim() || undefined),
  ktpKey: z
    .string()
    .max(300)
    .optional()
    .transform(s => s?.trim() || undefined),
  residentPermitFrontKey: z
    .string()
    .max(300)
    .optional()
    .transform(s => s?.trim() || undefined),
  residentPermitBackKey: z
    .string()
    .max(300)
    .optional()
    .transform(s => s?.trim() || undefined),
  passportKey: z
    .string()
    .max(300)
    .optional()
    .transform(s => s?.trim() || undefined),
  passportEntryKey: z
    .string()
    .max(300)
    .optional()
    .transform(s => s?.trim() || undefined),
  medicalReportKey: z
    .string()
    .max(300)
    .optional()
    .transform(s => s?.trim() || undefined),
  // 其他
  externalLink: z
    .string()
    .max(500)
    .optional()
    .transform(s => s?.trim() || undefined),
  notes: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
});

const customerInput = z.object({
  // 雇主類型
  employerType: z.enum(["individual", "company"]).default("company"),
  // 基本資料
  name: z.string().trim().min(2, "名稱至少 2 字").max(100, "名稱最多 100 字"),
  employerNo: z
    .string()
    .max(20)
    .optional()
    .transform(s => s?.trim() || undefined),
  phone: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  landline: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  address: z
    .string()
    .max(200)
    .optional()
    .transform(s => s?.trim() || undefined),
  registeredAddress: z
    .string()
    .max(200)
    .optional()
    .transform(s => s?.trim() || undefined),
  referrer: z
    .string()
    .max(100)
    .optional()
    .transform(s => s?.trim() || undefined),
  // 個人雇主專屬
  idNo: z
    .string()
    .max(12)
    .optional()
    .transform(s => s?.trim() || undefined),
  preCourseNo: z
    .string()
    .max(50)
    .optional()
    .transform(s => s?.trim() || undefined),
  idFrontKey: z
    .string()
    .max(300)
    .optional()
    .transform(s => s?.trim() || undefined),
  idBackKey: z
    .string()
    .max(300)
    .optional()
    .transform(s => s?.trim() || undefined),
  // 被照顧者資料
  careReceiverNo: z
    .string()
    .max(20)
    .optional()
    .transform(s => s?.trim() || undefined),
  careReceiverName: z
    .string()
    .max(50)
    .optional()
    .transform(s => s?.trim() || undefined),
  careReceiverBirthDate: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  careReceiverIdNo: z
    .string()
    .max(12)
    .optional()
    .transform(s => s?.trim() || undefined),
  careReceiverAddress: z
    .string()
    .max(200)
    .optional()
    .transform(s => s?.trim() || undefined),
  careReceiverQualification: z
    .string()
    .max(100)
    .optional()
    .transform(s => s?.trim() || undefined),
  careReceiverRelation: z
    .string()
    .max(50)
    .optional()
    .transform(s => s?.trim() || undefined),
  careReceiverIdFrontKey: z
    .string()
    .max(300)
    .optional()
    .transform(s => s?.trim() || undefined),
  careReceiverIdBackKey: z
    .string()
    .max(300)
    .optional()
    .transform(s => s?.trim() || undefined),
  // 公司行號專屬
  taxId: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  industry: z
    .string()
    .max(50)
    .optional()
    .transform(s => s?.trim() || undefined),
  contactName: z
    .string()
    .max(50)
    .optional()
    .transform(s => s?.trim() || undefined),
  contactPhone: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  // 媒合案件
  caseNo: z
    .string()
    .max(20)
    .optional()
    .transform(s => s?.trim() || undefined),
  caseStatus: z
    .enum(["pending", "processing", "matched", "completed", "cancelled"])
    .optional(),
  // 申請資格
  jobSeekerType: z
    .enum(["new_hire", "renewal", "transfer", "supplement"])
    .optional(),
  jobSeekerDate: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  jobSeekerFileKey: z
    .string()
    .max(300)
    .optional()
    .transform(s => s?.trim() || undefined),
  recruitmentLetterType: z.enum(["domestic", "overseas", "both"]).optional(),
  recruitmentLetterDate: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  recruitmentLetterFileKey: z
    .string()
    .max(300)
    .optional()
    .transform(s => s?.trim() || undefined),
  recruitmentPermitNote: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  recruitmentPermitDays: z.number().int().optional(),
  previousWorkerDepartureDate: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  // 聘僱函
  employmentLetterType: z.enum(["initial", "renewal", "transfer"]).optional(),
  employmentLetterDate: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  employmentLetterFileKey: z
    .string()
    .max(300)
    .optional()
    .transform(s => s?.trim() || undefined),
  approvedStartDate: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  approvedPeriod: z
    .string()
    .max(50)
    .optional()
    .transform(s => s?.trim() || undefined),
  approvedEndDate: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  // 系統欄位
  contractStatus: z.enum([
    "negotiating",
    "signed",
    "in_service",
    "pending_renewal",
    "ended",
  ]),
  pricingTier: z.enum(["standard", "custom"]),
  managerId: z.number().int().positive("負責人為必填"),
  notes: z
    .string()
    .optional()
    .transform(s => s?.trim() || undefined),
  forceCreate: z.boolean().optional(),
});

// ─── Worker Validation Helper ─────────────────────────────────────────────────
function validateWorkerData(
  data: z.infer<typeof workerInput>,
  excludeId?: number
) {
  return async () => {
    // 居留證格式
    if (data.residentPermitNo) {
      if (!validateResidentPermit(data.residentPermitNo)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "居留證統一證號格式不正確（格式：1字母+9碼數字，或2字母+8碼數字，共10碼）",
        });
      }
      // 唯一性
      const existing = await getWorkerByPermitNo(
        data.residentPermitNo,
        excludeId
      );
      if (existing)
        throw new TRPCError({
          code: "CONFLICT",
          message: "此居留證號已存在，請確認是否重複建檔",
        });
    }
    // 護照格式
    if (data.passportNo) {
      if (!validatePassport(data.passportNo)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "護照號碼格式不正確（應為 6-9 碼英數字）",
        });
      }
      // 唯一性
      const existing = await getWorkerByPassportNo(data.passportNo, excludeId);
      if (existing)
        throw new TRPCError({
          code: "CONFLICT",
          message: "此護照號碼已存在，請確認是否重複建檔",
        });
    }
    // 電話格式
    if (data.phone && !validateTwPhone(data.phone)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "電話格式不正確（手機 09 開頭 10 碼，或市話格式）",
      });
    }
    // Email 格式
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "電子信箱格式不正確",
        });
      }
    }
    // 入境日期不可晚於今天
    if (data.entryDate && !validateNotFutureDate(data.entryDate)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "入境日期不可晚於今天",
      });
    }
    // 外部連結 URL 格式
    if (data.externalLink) {
      try {
        const url = new URL(data.externalLink);
        if (!["http:", "https:"].includes(url.protocol)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "連結格式不正確，請輸入完整 URL（例：https://drive.google.com/...）",
          });
        }
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "連結格式不正確，請輸入完整 URL（例：https://drive.google.com/...）",
        });
      }
    }
    // 跨欄位邏輯：在職時文件狀態不可為未啟動或待補件
    if (
      data.lifecycleStatus === "employed" &&
      (data.documentStatus === "not_started" ||
        data.documentStatus === "pending_supplement")
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "在職移工的文件狀態不應為未完成，請確認",
      });
    }
  };
}

// ─── Customer Validation Helper ───────────────────────────────────────────────
function validateCustomerData(
  data: z.infer<typeof customerInput>,
  excludeId?: number
) {
  return async () => {
    if (data.taxId) {
      if (!validateTaxId(data.taxId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "統一編號格式不正確",
        });
      }
      const existingTaxId = await getCustomerByTaxId(data.taxId, excludeId);
      if (existingTaxId)
        throw new TRPCError({
          code: "CONFLICT",
          message: "此統一編號已存在，請確認是否重複建檔",
        });
    }
    if (data.contactPhone && !validateTwPhone(data.contactPhone)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "聯絡窗口電話格式不正確（手機 09 開頭 10 碼，或市話格式）",
      });
    }
  };
}

// ─── 自動計算欄位輔助函數 ──────────────────────────────────────────────────────
/** 計算距今剩餘天數（正數=未來，負數=已過期） */
function daysFromToday(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

/** 計算下次體檢日期（最近體檢日 + 5 個月） */
function calcNextMedicalExamDate(
  lastDate: string | null | undefined
): string | null {
  if (!lastDate) return null;
  const d = new Date(lastDate);
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + 5);
  return d.toISOString().slice(0, 10);
}

// ─── 公開媒合平台輔助（P1）────────────────────────────────────────────────────
type MarketplaceQualType =
  | "caregiver"
  | "domestic_helper"
  | "manufacturing"
  | "agriculture"
  | "construction"
  | "white_collar"
  | "intermediate"
  | "overseas_student";

/** 內部職類 → 案件命名用中文標籤。 */
const QUAL_TYPE_LABEL: Record<MarketplaceQualType, string> = {
  caregiver: "看護",
  domestic_helper: "幫傭",
  manufacturing: "製造業",
  agriculture: "農業",
  construction: "營造業",
  white_collar: "白領",
  intermediate: "中階技術",
  overseas_student: "僑外生",
};

/** 公開站三桶職類：看護 / 房務 / 其他。 */
function jobCategory(
  qualType: MarketplaceQualType
): "caregiver" | "domestic_helper" | "other" {
  if (qualType === "caregiver") return "caregiver";
  if (qualType === "domestic_helper") return "domestic_helper";
  return "other";
}

/** 需求單轉 case 時，依職類推斷案件資格類別（勞基法內外 / 專業評點）。 */
function inferQualCategory(
  qualType: MarketplaceQualType
): "labor_in" | "labor_out" | "professional" {
  if (
    qualType === "white_collar" ||
    qualType === "overseas_student" ||
    qualType === "intermediate"
  )
    return "professional";
  if (qualType === "caregiver" || qualType === "domestic_helper")
    return "labor_out";
  return "labor_in";
}

/** 雇主張貼／編輯需求單的共用欄位（規格 §7.3：職類/地點/人數/聘僱型態必填）。 */
const jobPostingInput = z.object({
  jobType: z.enum([
    "caregiver",
    "domestic_helper",
    "manufacturing",
    "agriculture",
    "construction",
    "white_collar",
    "intermediate",
    "overseas_student",
  ]),
  city: z.string().trim().min(1, "請選擇工作縣市").max(20),
  district: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform(s => s?.trim() || undefined),
  headcount: z.number().int().min(1, "至少 1 人").max(99).default(1),
  employmentType: z
    .enum(["live_in", "live_out", "institution", "other"])
    .default("live_in"),
  requirements: z
    .string()
    .max(2000)
    .optional()
    .transform(s => s?.trim() || undefined),
  publicDescription: z
    .string()
    .max(2000)
    .optional()
    .transform(s => s?.trim() || undefined),
  salaryMin: z.number().int().min(0).max(999999).optional(),
  salaryMax: z.number().int().min(0).max(999999).optional(),
  expectedStartDate: z
    .string()
    .max(10)
    .optional()
    .transform(s => s?.trim() || undefined),
});

/**
 * 解析媒合意向標的的「去識別摘要」（職缺類 / 縣市），供客服佇列與「我的意向」共用。
 * 只回結構化欄位，不含任何雇主 PII。worker 標的（找移工 P2）尚未建，先回 null。
 */
async function resolveMatchTargetSummary(
  targetType: "job_posting" | "case_demand" | "worker",
  targetId: number
): Promise<{
  jobType: string | null;
  city: string | null;
  label: string;
} | null> {
  if (targetType === "job_posting") {
    const p = await getJobPostingById(targetId);
    if (!p) return null;
    return { jobType: p.jobType, city: p.city, label: "公開需求單" };
  }
  if (targetType === "case_demand") {
    const d = await getDemandById(targetId);
    if (!d) return null;
    const c = await getCaseById(d.caseId);
    return {
      jobType: d.qualType,
      city: c?.publicCity ?? null,
      label: "既有需求單",
    };
  }
  if (targetType === "worker") {
    const p = await getProfileById(targetId);
    if (!p) return null;
    return {
      jobType: p.jobType,
      city: p.availability ?? null, // 移工無地點，借欄位帶「可上工時間」供客服參考
      label: p.alias ? `移工履歷（${p.alias}）` : "移工履歷",
    };
  }
  return null;
}

// ─── 移工公開履歷（P2）輔助 ──────────────────────────────────────────────────
/** 出生年 → 年齡區間（5 歲一段，去識別，不露精確生日）。今年由伺服器時鐘取得。 */
function ageRangeFromYear(year: number | null | undefined): string | null {
  if (!year || year < 1900) return null;
  const now = new Date().getFullYear();
  const age = now - year;
  if (age < 0 || age > 120) return null;
  const lo = Math.floor(age / 5) * 5;
  return `${lo}–${lo + 4}`;
}

/** 安全解析 JSON 陣列欄位（skills/languages），壞資料一律回空陣列。 */
function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(x => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * 把履歷正本轉成「對外匿名視圖」：只露去識別子集，永不含 userId/workerId、
 * 真實姓名、證件、聯絡方式（規格 §11）。id 為 profile id，供詳情/送意向使用。
 */
function publicProfileView(p: {
  id: number;
  alias: string | null;
  headline: string | null;
  nationality: string | null;
  yearOfBirth: number | null;
  jobType: string | null;
  skills: string | null;
  languages: string | null;
  availability: string | null;
  selfIntro: string | null;
}) {
  return {
    id: p.id,
    alias: p.alias || `移工 #${p.id}`,
    headline: p.headline,
    nationality: p.nationality,
    ageRange: ageRangeFromYear(p.yearOfBirth),
    jobType: p.jobType,
    category: p.jobType ? jobCategory(p.jobType as MarketplaceQualType) : null,
    skills: parseJsonArray(p.skills),
    languages: parseJsonArray(p.languages),
    availability: p.availability,
    selfIntro: p.selfIntro,
  };
}

/** 移工履歷編輯輸入（自助帳號自填；送審時 moderationStatus 回 pending）。 */
const workerProfileInput = z.object({
  alias: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform(s => s?.trim() || undefined),
  headline: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform(s => s?.trim() || undefined),
  nationality: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform(s => s?.trim() || undefined),
  yearOfBirth: z.number().int().min(1900).max(2020).optional(),
  jobType: z
    .enum([
      "caregiver",
      "domestic_helper",
      "manufacturing",
      "agriculture",
      "construction",
      "white_collar",
      "intermediate",
      "overseas_student",
    ])
    .optional(),
  skills: z.array(z.string().trim().max(30)).max(20).optional(),
  languages: z.array(z.string().trim().max(30)).max(10).optional(),
  availability: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform(s => s?.trim() || undefined),
  selfIntro: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform(s => s?.trim() || undefined),
});

/**
 * 找移工 gating（§15-1）：瀏覽（list/get）已開放匿名；此關僅擋「送出媒合意向」——
 * 雇主需至少一張通過審核的需求單才能聯繫移工；staff/admin 免限制。
 */
async function assertCanBrowseWorkers(user: {
  id: number;
  role: string;
}): Promise<void> {
  if (user.role === "staff" || user.role === "admin") return;
  const approved = await countApprovedPostingsByEmployer(user.id);
  if (approved === 0)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "需先有一張通過審核的需求單才能瀏覽移工履歷",
    });
}

/** 自填經歷輸入。 */
const workerExperienceInput = z.object({
  employerType: z.enum([
    "family_care",
    "institution",
    "manufacturing",
    "agriculture",
    "construction",
    "other",
  ]),
  role: z.string().trim().min(1, "請填職務").max(100),
  startDate: z
    .string()
    .trim()
    .max(10)
    .optional()
    .transform(s => s?.trim() || undefined),
  endDate: z
    .string()
    .trim()
    .max(10)
    .optional()
    .transform(s => s?.trim() || undefined),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform(s => s?.trim() || undefined),
});

// ─── Routers ──────────────────────────────────────────────────────────────────
/**
 * 「有效」的配對成員階段 —— 尚未離開此案件的狀態。
 *
 * 不變量：同一案件同一移工只能有一筆有效成員。這條規則在三個地方都要守：
 * create、addWorker、以及 updateMemberStage（把終態改回有效階段時）。
 * 少守任何一處都會讓同案件出現重複的移工紀錄。
 */
const ACTIVE_MEMBER_STAGES = [
  "candidate",
  "confirmed",
  "upcoming",
  "employed",
] as const;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      await logAudit(ctx, { action: "auth.logout" });
      return { success: true } as const;
    }),

    // ─── Email/密碼 註冊（公開；社群/OAuth 走 /api/oauth 與後續 P1 供應商）────────
    register: publicProcedure
      .input(
        z.object({
          email: z
            .string()
            .trim()
            .toLowerCase()
            .email("Email 格式不正確")
            .max(320),
          password: z.string().min(8, "密碼至少 8 碼").max(200),
          accountType: z.enum(["worker", "employer"]),
          name: z
            .string()
            .trim()
            .max(100)
            .optional()
            .transform(s => s?.trim() || undefined),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "此 Email 已註冊" });
        }
        const openId = newLocalOpenId();
        const passwordHash = await hashPassword(input.password);
        const id = await createUser({
          openId,
          email: input.email,
          name: input.name ?? null,
          loginMethod: "email",
          role: "user",
          accountType: input.accountType,
          passwordHash,
          lastSignedIn: new Date(),
        });
        await issueSession(ctx.req, ctx.res, {
          openId,
          name: input.name ?? null,
        });
        await logAudit(ctx, {
          action: "auth.register",
          entityType: "users",
          entityId: id,
          actorUserId: id,
          meta: { accountType: input.accountType, loginMethod: "email" },
        });
        return { success: true, id, accountType: input.accountType } as const;
      }),

    // ─── Email/密碼 登入（公開）───────────────────────────────────────────────
    login: publicProcedure
      .input(
        z.object({
          email: z
            .string()
            .trim()
            .toLowerCase()
            .email("Email 格式不正確")
            .max(320),
          password: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByEmail(input.email);
        const ok =
          user && (await verifyPassword(input.password, user.passwordHash));
        // 不區分「帳號不存在」與「密碼錯誤」，避免洩漏 email 是否註冊
        if (!user || !ok) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "帳號或密碼錯誤",
          });
        }
        await issueSession(ctx.req, ctx.res, {
          openId: user.openId,
          name: user.name,
        });
        await logAudit(ctx, {
          action: "auth.login",
          actorUserId: user.id,
          meta: { loginMethod: "email" },
        });
        return { success: true } as const;
      }),
  }),

  // ─── Dashboard（統計總覽）────────────────────────────────────────────────────
  dashboard: router({
    summary: staffProcedure.query(async () => {
      const CLOSED_STATUSES = ["returned", "absconded"];
      const EXPIRY_WINDOW_DAYS = 60;

      // ── 日期基準（採台北時區，避免伺服器時區造成 off-by-one）──────────────
      const DAY_MS = 86400000;
      const todayStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()); // YYYY-MM-DD
      const todayUtc = Date.parse(todayStr + "T00:00:00Z");
      const cutoffStr = new Date(todayUtc + EXPIRY_WINDOW_DAYS * DAY_MS)
        .toISOString()
        .slice(0, 10);
      const daysUntil = (dateStr: string) =>
        Math.round((Date.parse(dateStr + "T00:00:00Z") - todayUtc) / DAY_MS);

      // ── 計數下推 SQL + 只撈到期候選移工 ───────────────────────────────────
      const [counts, expiryCandidates] = await Promise.all([
        getDashboardCounts(),
        getExpiryCandidateWorkers(cutoffStr, CLOSED_STATUSES),
      ]);

      // 依固定順序（schema enum 順序）整理各維度分布，缺漏狀態補 0
      const orderCounts = <T extends string>(
        rows: { value: string | null; count: number }[],
        order: readonly T[]
      ) => {
        const map = new Map(rows.map(r => [r.value, r.count]));
        return order.map(value => ({ value, count: map.get(value) ?? 0 }));
      };
      const workersByLifecycle = orderCounts(counts.workersByLifecycle, [
        "employed",
        "idle_in_tw",
        "preparing_abroad",
        "returned",
        "absconded",
      ] as const);
      const casesByStatus = orderCounts(counts.casesByStatus, [
        "in_progress",
        "completed",
        "paused",
        "cancelled",
      ] as const);
      const customersByType = orderCounts(counts.customersByType, [
        "individual",
        "company",
      ] as const);
      const employed =
        workersByLifecycle.find(r => r.value === "employed")?.count ?? 0;

      // ── 證件到期清單（逐證件，供下方列表顯示）─────────────────────────────
      const expiringDocuments = expiryCandidates
        .flatMap(w => {
          const docs: {
            docType: "residentPermit" | "passport";
            expiry: string;
          }[] = [];
          if (w.residentPermitExpiry)
            docs.push({
              docType: "residentPermit",
              expiry: w.residentPermitExpiry,
            });
          if (w.passportExpiry)
            docs.push({ docType: "passport", expiry: w.passportExpiry });
          return docs.map(doc => ({
            workerId: w.id,
            name: w.name,
            docType: doc.docType,
            expiry: doc.expiry,
            daysLeft: daysUntil(doc.expiry),
          }));
        })
        .filter(d => d.daysLeft <= EXPIRY_WINDOW_DAYS)
        .sort((a, b) => a.daysLeft - b.daysLeft);

      // ── 到期口徑：以「移工人數」計算，兩者互斥（已過期優先）──────────────
      // 一人即使同時有居留證與護照到期，也只計一次；有任一張已過期即歸「已過期」。
      const expiredWorkerIds = new Set<number>();
      const expiringSoonWorkerIds = new Set<number>();
      for (const d of expiringDocuments) {
        if (d.daysLeft < 0) expiredWorkerIds.add(d.workerId);
      }
      for (const d of expiringDocuments) {
        if (d.daysLeft >= 0 && !expiredWorkerIds.has(d.workerId))
          expiringSoonWorkerIds.add(d.workerId);
      }

      const totals = {
        workers: counts.totals.workers,
        customers: counts.totals.customers,
        cases: counts.totals.cases,
        employed,
        expiringSoon: expiringSoonWorkerIds.size,
        expired: expiredWorkerIds.size,
      };

      // ── 趨勢：upsert 當日快照，與前一筆快照比較 ───────────────────────────
      // 註：快照於「儀表板被載入時」寫入，因此趨勢比較的是「上次有人查看的那天」。
      //
      // 快照相關的失敗一律降級成「沒有趨勢」，不讓整個儀表板掛掉。
      // 趨勢只是加分資訊，但移工/雇主/案件總數與證件到期提醒是每天要看的東西 ——
      // 曾經發生過 kpi_snapshots 查詢失敗導致整頁空白（schema 變更後連線池裡的
      // prepared statement 失效），那時核心數字明明查得到卻一個都顯示不出來。
      let prev: Awaited<ReturnType<typeof getPreviousKpiSnapshot>> = undefined;
      try {
        prev = await getPreviousKpiSnapshot(todayStr);
        await upsertKpiSnapshot({ snapshotDate: todayStr, ...totals });
      } catch (error) {
        console.error("[dashboard] KPI 快照讀寫失敗，本次不顯示趨勢：", error);
        prev = undefined;
      }
      const trends = prev
        ? {
            workers: totals.workers - prev.workers,
            customers: totals.customers - prev.customers,
            cases: totals.cases - prev.cases,
            employed: totals.employed - prev.employed,
            expiringSoon: totals.expiringSoon - prev.expiringSoon,
            expired: totals.expired - prev.expired,
            since: prev.snapshotDate,
          }
        : null;

      return {
        totals,
        trends,
        workersByLifecycle,
        casesByStatus,
        customersByType,
        expiringDocuments,
        generatedAt: new Date().toISOString(),
      };
    }),

    // ─── 法定合規提醒（同一套引擎）───────────────────────────────────────────
    // 一次算出兩類會被主管機關裁處的到期義務，回傳需處理清單：
    //   ① 定期健檢（工作滿 6/18/30 個月，前後 30 日窗口）——避免衛生局逾期移送
    //   ② 聘僱許可續聘（核准聘僱截止日前須辦續聘/展延）——避免許可到期失效
    // 居留證/護照到期已由 dashboard.summary 的證件到期提醒涵蓋，不在此重複。
    compliance: staffProcedure.query(async () => {
      const CLOSED_STATUSES = ["returned", "absconded"];
      const todayStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()); // YYYY-MM-DD（台北時區）

      // 合規查詢失敗一律降級成「空清單」，不讓鈴鐺/儀表板因後端例外而卡住
      // （曾發生過 schema 變更後連線池 prepared statement 失效導致查詢丟例外）。
      let candidates: Awaited<ReturnType<typeof getComplianceCandidates>> = [];
      try {
        candidates = await getComplianceCandidates(CLOSED_STATUSES);
      } catch (error) {
        console.error("[compliance] 合規候選查詢失敗，本次回空清單：", error);
      }

      type ComplianceAlert = {
        kind: "health_check" | "employment_permit";
        caseId: number;
        caseNo: string;
        caseName: string;
        workerId: number;
        workerName: string;
        managerName: string;
        title: string;
        status: HealthCheckStatus;
        anchorDate: string | null;
        anchorSource: "approved" | "continuous" | null;
        dueDate: string; // 關鍵到期日（健檢＝基準日；許可＝截止日）
        deadlineDate: string; // 最後期限（健檢＝窗口迄日；許可＝截止日），逾期天數以此算
        daysToDeadline: number; // 今天 → deadlineDate
        // 健檢專屬
        milestone?: 6 | 18 | 30;
        windowStart?: string;
        windowEnd?: string;
        recordedSource?: "case" | "worker" | null;
        // 許可專屬
        endDateSource?: "approvedEndDate" | "computed";
      };

      const alerts = candidates.flatMap((c): ComplianceAlert[] => {
        if (!c.workerId) return [];
        const workerId = c.workerId;
        // 基準日：優先雇主資格核准聘僱起始日，退而求其次案件接續聘僱日期
        const anchorDate =
          c.approvedStartDate || c.continuousEmploymentDate || null;
        const anchorSource: "approved" | "continuous" | null =
          c.approvedStartDate
            ? "approved"
            : c.continuousEmploymentDate
              ? "continuous"
              : null;
        const displayName =
          c.workerNameCn || c.workerNameEn || c.workerName || "—";
        const managerName = c.managerName ?? "—";
        const base = {
          caseId: c.caseId,
          caseNo: c.caseNo ?? "",
          caseName: c.caseName,
          workerId,
          workerName: displayName,
          managerName,
        };
        const out: ComplianceAlert[] = [];

        // ① 定期健檢（需要基準日才能推算）
        if (anchorDate && anchorSource) {
          const results = evaluateHealthChecks({
            anchorDate,
            today: todayStr,
            recorded: { 6: c.exam6mDate, 18: c.exam18mDate, 30: c.exam30mDate },
            // 健檢資料分兩處：移工檔的體檢日若落在窗口內也算完成
            fallbackExamDates: [c.workerLastMedicalExamDate],
          });
          for (const r of results) {
            if (!isActionableStatus(r.status)) continue;
            out.push({
              ...base,
              kind: "health_check",
              title: milestoneLabel(r.milestone),
              status: r.status,
              anchorDate,
              anchorSource,
              dueDate: r.dueDate,
              deadlineDate: r.windowEnd,
              daysToDeadline: r.daysToWindowEnd,
              milestone: r.milestone,
              windowStart: r.windowStart,
              windowEnd: r.windowEnd,
              recordedSource: r.recordedSource,
            });
          }
        }

        // ② 聘僱許可續聘（核准聘僱截止日；缺值時由起始日 + 期間月數推算）
        if (!c.terminationDate) {
          let endDate: string | null = c.approvedEndDate || null;
          let endDateSource: "approvedEndDate" | "computed" = "approvedEndDate";
          if (!endDate && anchorDate && c.employmentPeriodMonths) {
            endDate = addMonthsYmd(anchorDate, c.employmentPeriodMonths);
            endDateSource = "computed";
          }
          // 續聘提醒只需截止日即可；起始日缺漏也不該漏掉這個法定期限
          if (endDate) {
            const d = classifyDeadline(endDate, todayStr); // 預設提前 120 天、60 天內緊迫
            if (d && isActionableStatus(d.status)) {
              out.push({
                ...base,
                kind: "employment_permit",
                title: "聘僱許可續聘",
                status: d.status,
                anchorDate,
                anchorSource,
                dueDate: endDate,
                deadlineDate: endDate,
                daysToDeadline: d.daysLeft,
                endDateSource,
              });
            }
          }
        }

        return out;
      });

      // 逾期最前，其次緊迫、提前提醒；同級以最後期限近者優先
      alerts.sort((a, b) => {
        const byStatus = statusRank(a.status) - statusRank(b.status);
        if (byStatus !== 0) return byStatus;
        return a.daysToDeadline - b.daysToDeadline;
      });

      const countBy = (kind: ComplianceAlert["kind"] | "all") => {
        const pool =
          kind === "all" ? alerts : alerts.filter(a => a.kind === kind);
        return {
          overdue: pool.filter(a => a.status === "overdue").length,
          dueNow: pool.filter(a => a.status === "due_now").length,
          upcoming: pool.filter(a => a.status === "upcoming").length,
        };
      };

      return {
        alerts,
        counts: countBy("all"),
        countsByKind: {
          healthCheck: countBy("health_check"),
          employmentPermit: countBy("employment_permit"),
        },
        today: todayStr,
        generatedAt: new Date().toISOString(),
      };
    }),
  }),

  // ─── Managers ──────────────────────────────────────────────────────────────
  managers: router({
    list: staffProcedure.query(async () => getAllManagers()),
    create: staffProcedure
      .input(z.object({ name: z.string().trim().min(1, "名稱為必填").max(50) }))
      .mutation(async ({ input }) => {
        const id = await createManager({ name: input.name });
        return { success: true, id };
      }),
    delete: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        // 還有東西指派給這位負責人就不許刪。資料庫層的 FK 也會擋，但那會噴出
        // 使用者看不懂的原始 SQL 錯誤，所以這裡先給可讀的訊息。
        const deps = await countDependentsByManager(input.id);
        const parts = [
          deps.workers > 0 ? `${deps.workers} 位移工` : null,
          deps.customers > 0 ? `${deps.customers} 個雇主` : null,
          deps.cases > 0 ? `${deps.cases} 個案件` : null,
        ].filter(Boolean);
        if (parts.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `此負責人名下還有 ${parts.join("、")}，請先改派後再刪除`,
          });
        }
        await deleteManager(input.id);
        return { success: true };
      }),
  }),

  // ─── Workers ───────────────────────────────────────────────────────────────
  workers: router({
    list: staffProcedure.query(async () => {
      const rows = await getAllWorkers();
      // 附加自動計算欄位
      return rows.map(w => ({
        ...w,
        residentPermitDaysLeft: daysFromToday(w.residentPermitExpiry),
        passportDaysLeft: daysFromToday(w.passportExpiry),
        nextMedicalExamDate: calcNextMedicalExamDate(w.lastMedicalExamDate),
        nextMedicalExamDaysLeft: daysFromToday(
          calcNextMedicalExamDate(w.lastMedicalExamDate)
        ),
      }));
    }),
    getById: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const w = await getWorkerById(input.id);
        if (!w)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此移工" });
        return {
          ...w,
          residentPermitDaysLeft: daysFromToday(w.residentPermitExpiry),
          passportDaysLeft: daysFromToday(w.passportExpiry),
          nextMedicalExamDate: calcNextMedicalExamDate(w.lastMedicalExamDate),
          nextMedicalExamDaysLeft: daysFromToday(
            calcNextMedicalExamDate(w.lastMedicalExamDate)
          ),
        };
      }),
    create: staffProcedure.input(workerInput).mutation(async ({ input }) => {
      await validateWorkerData(input)();
      const phone = input.phone ? normalizePhone(input.phone) : undefined;
      const newId = await createWorker({
        name: input.nameCn || input.nameEn || input.name,
        workerNo: input.workerNo || null,
        nameEn: input.nameEn || null,
        nameCn: input.nameCn || null,
        birthDate: input.birthDate || null,
        gender: input.gender || null,
        nationality: input.nationality || null,
        birthPlace: input.birthPlace || null,
        occupation: input.occupation || null,
        lifecycleStatus: input.lifecycleStatus,
        documentStatus: input.documentStatus,
        managerId: input.managerId,
        residentPermitNo: input.residentPermitNo || null,
        residentPermitExpiry: input.residentPermitExpiry || null,
        passportNo: input.passportNo || null,
        passportExpiry: input.passportExpiry || null,
        entryDate: input.entryDate || null,
        phone: phone || null,
        email: input.email || null,
        lastMedicalExamDate: input.lastMedicalExamDate || null,
        nextMedicalExamType: input.nextMedicalExamType || null,
        photoKey: input.photoKey || null,
        ktpKey: input.ktpKey || null,
        residentPermitFrontKey: input.residentPermitFrontKey || null,
        residentPermitBackKey: input.residentPermitBackKey || null,
        passportKey: input.passportKey || null,
        passportEntryKey: input.passportEntryKey || null,
        medicalReportKey: input.medicalReportKey || null,
        externalLink: input.externalLink || null,
        notes: input.notes || null,
      });
      return { success: true, id: newId };
    }),
    update: staffProcedure
      .input(z.object({ id: z.number().int().positive() }).merge(workerInput))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await validateWorkerData(data, id)();
        const phone = data.phone ? normalizePhone(data.phone) : undefined;
        await updateWorker(id, {
          name: data.nameCn || data.nameEn || data.name,
          workerNo: data.workerNo || null,
          nameEn: data.nameEn || null,
          nameCn: data.nameCn || null,
          birthDate: data.birthDate || null,
          gender: data.gender || null,
          nationality: data.nationality || null,
          birthPlace: data.birthPlace || null,
          occupation: data.occupation || null,
          lifecycleStatus: data.lifecycleStatus,
          documentStatus: data.documentStatus,
          managerId: data.managerId,
          residentPermitNo: data.residentPermitNo || null,
          residentPermitExpiry: data.residentPermitExpiry || null,
          passportNo: data.passportNo || null,
          passportExpiry: data.passportExpiry || null,
          entryDate: data.entryDate || null,
          phone: phone || null,
          email: data.email || null,
          lastMedicalExamDate: data.lastMedicalExamDate || null,
          nextMedicalExamType: data.nextMedicalExamType || null,
          photoKey: data.photoKey || null,
          ktpKey: data.ktpKey || null,
          residentPermitFrontKey: data.residentPermitFrontKey || null,
          residentPermitBackKey: data.residentPermitBackKey || null,
          passportKey: data.passportKey || null,
          passportEntryKey: data.passportEntryKey || null,
          medicalReportKey: data.medicalReportKey || null,
          externalLink: data.externalLink || null,
          notes: data.notes || null,
        });
        return { success: true };
      }),
    delete: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteWorker(input.id);
        return { success: true };
      }),

    // ── S3 檔案上傳 ──────────────────────────────────────────────────────────
    uploadFile: staffProcedure
      .input(
        z.object({
          workerId: z.number().int().positive(),
          fieldName: z.enum([
            "photoKey",
            "ktpKey",
            "residentPermitFrontKey",
            "residentPermitBackKey",
            "passportKey",
            "passportEntryKey",
            "medicalReportKey",
          ]),
          fileName: z.string().max(200),
          fileBase64: z.string(), // base64 encoded file content
          mimeType: z.string().max(100),
        })
      )
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const key = `workers/${input.workerId}/${input.fieldName}/${Date.now()}_${input.fileName}`;
        const { key: storedKey, url } = await storagePut(
          key,
          buffer,
          input.mimeType
        );
        // 更新 worker 對應欄位
        await updateWorker(input.workerId, { [input.fieldName]: storedKey });
        return { key: storedKey, url };
      }),

    // ── CSV 批次匯入 ─────────────────────────────────────────────────────────
    import: staffProcedure
      .input(z.object({ rows: z.array(workerInput) }))
      .mutation(async ({ input }) => {
        const results: {
          index: number;
          name: string;
          success: boolean;
          error?: string;
        }[] = [];
        for (let i = 0; i < input.rows.length; i++) {
          const row = input.rows[i];
          try {
            await validateWorkerData(row)();
            const phone = row.phone ? normalizePhone(row.phone) : undefined;
            await createWorker({
              name: row.nameCn || row.nameEn || row.name,
              nameEn: row.nameEn || null,
              nameCn: row.nameCn || null,
              birthDate: row.birthDate || null,
              gender: row.gender || null,
              nationality: row.nationality || null,
              birthPlace: row.birthPlace || null,
              occupation: row.occupation || null,
              lifecycleStatus: row.lifecycleStatus,
              documentStatus: row.documentStatus,
              managerId: row.managerId,
              residentPermitNo: row.residentPermitNo || null,
              residentPermitExpiry: row.residentPermitExpiry || null,
              passportNo: row.passportNo || null,
              passportExpiry: row.passportExpiry || null,
              entryDate: row.entryDate || null,
              phone: phone || null,
              email: row.email || null,
              lastMedicalExamDate: row.lastMedicalExamDate || null,
              nextMedicalExamType: row.nextMedicalExamType || null,
              photoKey: null,
              ktpKey: null,
              residentPermitFrontKey: null,
              residentPermitBackKey: null,
              passportKey: null,
              passportEntryKey: null,
              medicalReportKey: null,
              externalLink: row.externalLink || null,
              notes: row.notes || null,
            });
            results.push({ index: i, name: row.name, success: true });
          } catch (err: any) {
            results.push({
              index: i,
              name: row.name,
              success: false,
              error: err?.message || "未知錯誤",
            });
          }
        }
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        return { successCount, failCount, results };
      }),
  }),

  // ─── Customers ─────────────────────────────────────────────────────────────
  customers: router({
    list: staffProcedure.query(async () => getAllCustomers()),
    getById: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const customer = await getCustomerById(input.id);
        if (!customer)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此客戶" });
        return customer;
      }),
    create: staffProcedure.input(customerInput).mutation(async ({ input }) => {
      await validateCustomerData(input)();
      if (!input.forceCreate) {
        const existingName = await getCustomerByName(input.name);
        if (existingName)
          throw new TRPCError({
            code: "CONFLICT",
            message: "DUPLICATE_NAME:已存在同名客戶，確定要繼續建立嗎？",
          });
      }
      const contactPhone = input.contactPhone
        ? normalizePhone(input.contactPhone)
        : undefined;
      const phone = input.phone ? normalizePhone(input.phone) : undefined;
      const landline = input.landline
        ? normalizePhone(input.landline)
        : undefined;
      const id = await createCustomer({
        employerType: input.employerType,
        name: input.name,
        employerNo: input.employerNo || null,
        phone: phone || null,
        landline: landline || null,
        address: input.address || null,
        registeredAddress: input.registeredAddress || null,
        referrer: input.referrer || null,
        idNo: input.idNo || null,
        preCourseNo: input.preCourseNo || null,
        idFrontKey: input.idFrontKey || null,
        idBackKey: input.idBackKey || null,
        careReceiverNo: input.careReceiverNo || null,
        careReceiverName: input.careReceiverName || null,
        careReceiverBirthDate: input.careReceiverBirthDate || null,
        careReceiverIdNo: input.careReceiverIdNo || null,
        careReceiverAddress: input.careReceiverAddress || null,
        careReceiverQualification: input.careReceiverQualification || null,
        careReceiverRelation: input.careReceiverRelation || null,
        careReceiverIdFrontKey: input.careReceiverIdFrontKey || null,
        careReceiverIdBackKey: input.careReceiverIdBackKey || null,
        taxId: input.taxId || null,
        industry: input.industry || null,
        contactName: input.contactName || null,
        contactPhone: contactPhone || null,
        caseNo: input.caseNo || null,
        caseStatus: input.caseStatus || null,
        jobSeekerType: input.jobSeekerType || null,
        jobSeekerDate: input.jobSeekerDate || null,
        jobSeekerFileKey: input.jobSeekerFileKey || null,
        recruitmentLetterType: input.recruitmentLetterType || null,
        recruitmentLetterDate: input.recruitmentLetterDate || null,
        recruitmentLetterFileKey: input.recruitmentLetterFileKey || null,
        recruitmentPermitNote: input.recruitmentPermitNote || null,
        recruitmentPermitDays: input.recruitmentPermitDays ?? null,
        previousWorkerDepartureDate: input.previousWorkerDepartureDate || null,
        employmentLetterType: input.employmentLetterType || null,
        employmentLetterDate: input.employmentLetterDate || null,
        employmentLetterFileKey: input.employmentLetterFileKey || null,
        approvedStartDate: input.approvedStartDate || null,
        approvedPeriod: input.approvedPeriod || null,
        approvedEndDate: input.approvedEndDate || null,
        contractStatus: input.contractStatus,
        pricingTier: input.pricingTier,
        managerId: input.managerId,
        notes: input.notes || null,
      });
      return { success: true, id };
    }),
    update: staffProcedure
      .input(z.object({ id: z.number().int().positive() }).merge(customerInput))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await validateCustomerData(data, id)();
        const contactPhone = data.contactPhone
          ? normalizePhone(data.contactPhone)
          : undefined;
        const phone = data.phone ? normalizePhone(data.phone) : undefined;
        const landline = data.landline
          ? normalizePhone(data.landline)
          : undefined;
        await updateCustomer(id, {
          employerType: data.employerType,
          name: data.name,
          employerNo: data.employerNo || null,
          phone: phone || null,
          landline: landline || null,
          address: data.address || null,
          registeredAddress: data.registeredAddress || null,
          referrer: data.referrer || null,
          idNo: data.idNo || null,
          preCourseNo: data.preCourseNo || null,
          idFrontKey: data.idFrontKey || null,
          idBackKey: data.idBackKey || null,
          careReceiverNo: data.careReceiverNo || null,
          careReceiverName: data.careReceiverName || null,
          careReceiverBirthDate: data.careReceiverBirthDate || null,
          careReceiverIdNo: data.careReceiverIdNo || null,
          careReceiverAddress: data.careReceiverAddress || null,
          careReceiverQualification: data.careReceiverQualification || null,
          careReceiverRelation: data.careReceiverRelation || null,
          careReceiverIdFrontKey: data.careReceiverIdFrontKey || null,
          careReceiverIdBackKey: data.careReceiverIdBackKey || null,
          taxId: data.taxId || null,
          industry: data.industry || null,
          contactName: data.contactName || null,
          contactPhone: contactPhone || null,
          caseNo: data.caseNo || null,
          caseStatus: data.caseStatus || null,
          jobSeekerType: data.jobSeekerType || null,
          jobSeekerDate: data.jobSeekerDate || null,
          jobSeekerFileKey: data.jobSeekerFileKey || null,
          recruitmentLetterType: data.recruitmentLetterType || null,
          recruitmentLetterDate: data.recruitmentLetterDate || null,
          recruitmentLetterFileKey: data.recruitmentLetterFileKey || null,
          recruitmentPermitNote: data.recruitmentPermitNote || null,
          recruitmentPermitDays: data.recruitmentPermitDays ?? null,
          previousWorkerDepartureDate: data.previousWorkerDepartureDate || null,
          employmentLetterType: data.employmentLetterType || null,
          employmentLetterDate: data.employmentLetterDate || null,
          employmentLetterFileKey: data.employmentLetterFileKey || null,
          approvedStartDate: data.approvedStartDate || null,
          approvedPeriod: data.approvedPeriod || null,
          approvedEndDate: data.approvedEndDate || null,
          contractStatus: data.contractStatus,
          pricingTier: data.pricingTier,
          managerId: data.managerId,
          notes: data.notes || null,
        });
        return { success: true };
      }),
    delete: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        // 底下還有案件就不許刪 —— 案件牽涉勞動部許可函與聘僱契約，
        // 誤刪難以回復，因此要求先處理完案件，而非連坐刪除。
        const caseCount = await countCasesByCustomer(input.id);
        if (caseCount > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `此雇主底下還有 ${caseCount} 個案件，請先刪除或轉移案件後再刪除雇主`,
          });
        }
        await deleteCustomer(input.id);
        return { success: true };
      }),

    // ── S3 檔案上傳 ────────────────────────────────────────────────────────────────────────────────────
    uploadFile: staffProcedure
      .input(
        z.object({
          fieldName: z.enum([
            "idFrontKey",
            "idBackKey",
            "careReceiverIdFrontKey",
            "careReceiverIdBackKey",
            "jobSeekerFileKey",
            "recruitmentLetterFileKey",
            "employmentLetterFileKey",
          ]),
          fileName: z.string().max(200),
          fileBase64: z.string(),
          mimeType: z.string().max(100),
        })
      )
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const key = `customers/${input.fieldName}/${Date.now()}_${input.fileName}`;
        const { key: storedKey, url } = await storagePut(
          key,
          buffer,
          input.mimeType
        );
        return { key: storedKey, url };
      }),
    // ─── Care Receivers CRUD ───────────────────────────────────────────────────────────────────────────────
    careReceivers: router({
      listByCustomer: staffProcedure
        .input(z.object({ customerId: z.number().int().positive() }))
        .query(async ({ input }) =>
          getCareReceiversByCustomerId(input.customerId)
        ),
      create: staffProcedure
        .input(
          z.object({
            customerId: z.number().int().positive(),
            careReceiverNo: z.string().max(20).optional().nullable(),
            careReceiverName: z.string().max(50).optional().nullable(),
            careReceiverBirthDate: z.string().max(10).optional().nullable(),
            careReceiverIdNo: z.string().max(12).optional().nullable(),
            careReceiverAddress: z.string().max(200).optional().nullable(),
            careReceiverQualification: z
              .string()
              .max(100)
              .optional()
              .nullable(),
            careReceiverRelation: z.string().max(50).optional().nullable(),
            careReceiverIdFrontKey: z.string().max(300).optional().nullable(),
            careReceiverIdBackKey: z.string().max(300).optional().nullable(),
            notes: z.string().optional().nullable(),
          })
        )
        .mutation(async ({ input }) => {
          const id = await createCareReceiver(input);
          return { id };
        }),
      update: staffProcedure
        .input(
          z.object({
            id: z.number().int().positive(),
            careReceiverNo: z.string().max(20).optional().nullable(),
            careReceiverName: z.string().max(50).optional().nullable(),
            careReceiverBirthDate: z.string().max(10).optional().nullable(),
            careReceiverIdNo: z.string().max(12).optional().nullable(),
            careReceiverAddress: z.string().max(200).optional().nullable(),
            careReceiverQualification: z
              .string()
              .max(100)
              .optional()
              .nullable(),
            careReceiverRelation: z.string().max(50).optional().nullable(),
            careReceiverIdFrontKey: z.string().max(300).optional().nullable(),
            careReceiverIdBackKey: z.string().max(300).optional().nullable(),
            notes: z.string().optional().nullable(),
          })
        )
        .mutation(async ({ input }) => {
          const { id, ...data } = input;
          await updateCareReceiver(id, data);
          return { success: true };
        }),
      delete: staffProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteCareReceiver(input.id);
          return { success: true };
        }),
    }),
    // ─── Customer Qualifications CRUD ─────────────────────────────────────────────────────────────────────
    qualifications: router({
      listByCustomer: staffProcedure
        .input(z.object({ customerId: z.number().int().positive() }))
        .query(async ({ input }) =>
          getQualificationsByCustomerId(input.customerId)
        ),
      create: staffProcedure
        .input(
          z.object({
            customerId: z.number().int().positive(),
            qualifierCategory: z.enum(["family", "business"]).default("family"),
            careReceiverId: z.number().int().positive().optional().nullable(),
            caseId: z.number().int().positive().optional().nullable(),
            label: z.string().max(100).optional().nullable(),
            caseNo: z.string().max(20).optional().nullable(),
            caseStatus: z
              .enum([
                "pending",
                "processing",
                "matched",
                "completed",
                "cancelled",
              ])
              .optional()
              .nullable(),
            managerId: z.number().int().positive().optional().nullable(),
            jobSeekerType: z
              .enum(["new_hire", "renewal", "transfer", "supplement"])
              .optional()
              .nullable(),
            jobSeekerDate: z.string().max(10).optional().nullable(),
            jobSeekerFileKey: z.string().max(300).optional().nullable(),
            recruitmentLetterType: z
              .enum(["domestic", "overseas", "both"])
              .optional()
              .nullable(),
            recruitmentLetterDate: z.string().max(10).optional().nullable(),
            recruitmentLetterFileKey: z.string().max(300).optional().nullable(),
            recruitmentPermitNote: z.string().optional().nullable(),
            recruitmentPermitDays: z.number().int().optional().nullable(),
            previousWorkerDepartureDate: z
              .string()
              .max(10)
              .optional()
              .nullable(),
            employmentLetterType: z
              .enum(["initial", "renewal", "transfer"])
              .optional()
              .nullable(),
            employmentLetterDate: z.string().max(10).optional().nullable(),
            employmentLetterFileKey: z.string().max(300).optional().nullable(),
            approvedStartDate: z.string().max(10).optional().nullable(),
            approvedPeriod: z.string().max(50).optional().nullable(),
            approvedEndDate: z.string().max(10).optional().nullable(),
            notes: z.string().optional().nullable(),
          })
        )
        .mutation(async ({ input }) => {
          const id = await createCustomerQualification(input);
          return { id };
        }),
      update: staffProcedure
        .input(
          z.object({
            id: z.number().int().positive(),
            qualifierCategory: z.enum(["family", "business"]).optional(),
            careReceiverId: z.number().int().positive().optional().nullable(),
            caseId: z.number().int().positive().optional().nullable(),
            label: z.string().max(100).optional().nullable(),
            caseNo: z.string().max(20).optional().nullable(),
            caseStatus: z
              .enum([
                "pending",
                "processing",
                "matched",
                "completed",
                "cancelled",
              ])
              .optional()
              .nullable(),
            managerId: z.number().int().positive().optional().nullable(),
            jobSeekerType: z
              .enum(["new_hire", "renewal", "transfer", "supplement"])
              .optional()
              .nullable(),
            jobSeekerDate: z.string().max(10).optional().nullable(),
            jobSeekerFileKey: z.string().max(300).optional().nullable(),
            recruitmentLetterType: z
              .enum(["domestic", "overseas", "both"])
              .optional()
              .nullable(),
            recruitmentLetterDate: z.string().max(10).optional().nullable(),
            recruitmentLetterFileKey: z.string().max(300).optional().nullable(),
            recruitmentPermitNote: z.string().optional().nullable(),
            recruitmentPermitDays: z.number().int().optional().nullable(),
            previousWorkerDepartureDate: z
              .string()
              .max(10)
              .optional()
              .nullable(),
            employmentLetterType: z
              .enum(["initial", "renewal", "transfer"])
              .optional()
              .nullable(),
            employmentLetterDate: z.string().max(10).optional().nullable(),
            employmentLetterFileKey: z.string().max(300).optional().nullable(),
            approvedStartDate: z.string().max(10).optional().nullable(),
            approvedPeriod: z.string().max(50).optional().nullable(),
            approvedEndDate: z.string().max(10).optional().nullable(),
            notes: z.string().optional().nullable(),
          })
        )
        .mutation(async ({ input }) => {
          const { id, ...data } = input;
          await updateCustomerQualification(id, data);
          return { success: true };
        }),
      delete: staffProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteCustomerQualification(input.id);
          return { success: true };
        }),
    }),
  }),

  // ─── Cases Router ─────────────────────────────────────────────────────
  cases: router({
    list: staffProcedure
      .input(
        z
          .object({
            customerId: z.number().int().positive().optional(),
            status: z.string().optional(),
            managerId: z.number().int().positive().optional(),
            search: z.string().optional(),
            orderBy: z.enum(["created_desc", "created_asc", "name"]).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const rows = await getAllCases(input);
        if (rows.length === 0) return [];
        // 批次取得客戶、負責人、子表維度（消除 N+1）
        const caseIds = rows.map(c => c.id);
        const [allCustomers, allManagers, dimsMap] = await Promise.all([
          getAllCustomers(),
          getAllManagers(),
          getCaseDimensionsBatch(caseIds),
        ]);
        type CustomerRow = (typeof allCustomers)[0];
        type ManagerRow = (typeof allManagers)[0];
        const customerMap = new Map<number, CustomerRow>(
          allCustomers.map(c => [c.id, c])
        );
        const managerMap = new Map<number, ManagerRow>(
          allManagers.map(m => [m.id, m])
        );
        const orderBy = input?.orderBy ?? "created_desc";
        const enriched = rows.map(c => {
          const dims = dimsMap.get(c.id) ?? {
            qualCount: 0,
            demandCount: 0,
            assignmentCount: 0,
            memberCount: 0,
          };
          return {
            ...c,
            customerName: customerMap.get(c.customerId)?.name ?? "",
            managerName: managerMap.get(c.managerId)?.name ?? "",
            ...dims,
          };
        });
        return enriched.sort((a, b) => {
          if (orderBy === "name") return a.name.localeCompare(b.name, "zh-TW");
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return orderBy === "created_desc" ? tb - ta : ta - tb;
        });
      }),
    getById: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const c = await getCaseById(input.id);
        if (!c)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此案件" });
        // 並行取得客戶、負責人、子表維度、主要移工（消除序列往返）
        const [customer, allManagers, dimsMap, primaryWorker] =
          await Promise.all([
            getCustomerById(c.customerId),
            getAllManagers(),
            getCaseDimensionsBatch([c.id]),
            c.primaryWorkerId
              ? getWorkerById(c.primaryWorkerId)
              : Promise.resolve(null),
          ]);
        const manager = allManagers.find(m => m.id === c.managerId);
        const dims = dimsMap.get(c.id) ?? {
          qualCount: 0,
          demandCount: 0,
          assignmentCount: 0,
          memberCount: 0,
        };
        return {
          ...c,
          customerName: customer?.name ?? "",
          managerName: manager?.name ?? "",
          // 雇主資料（自動帶入）
          customerPhone: customer?.phone ?? "",
          customerAddress: customer?.address ?? "",
          careReceiverName: customer?.careReceiverName ?? "",
          careReceiverQualification: customer?.careReceiverQualification ?? "",
          employerType: customer?.employerType ?? "",
          // 移工資料（自動帶入）
          workerNameCn: primaryWorker?.nameCn ?? primaryWorker?.name ?? "",
          workerNameEn: primaryWorker?.nameEn ?? "",
          workerResidentPermitNo: primaryWorker?.residentPermitNo ?? "",
          workerResidentPermitExpiry: primaryWorker?.residentPermitExpiry ?? "",
          workerPassportNo: primaryWorker?.passportNo ?? "",
          workerPassportExpiry: primaryWorker?.passportExpiry ?? "",
          workerPhone: primaryWorker?.phone ?? "",
          workerBirthPlace: primaryWorker?.birthPlace ?? "",
          workerNationality: primaryWorker?.nationality ?? "",
          ...dims,
        };
      }),
    create: staffProcedure
      .input(
        z.object({
          customerId: z.number().int().positive("客戶為必填"),
          name: z.string().trim().min(2, "案件名稱至少 2 字").max(100),
          managerId: z.number().int().positive("負責人為必填"),
          status: z
            .enum(["in_progress", "completed", "paused", "cancelled"])
            .default("in_progress"),
          caseCondition: z
            .string()
            .max(100)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          primaryWorkerId: z.number().int().positive().optional().nullable(),
          careReceiverId: z.number().int().positive().optional().nullable(),
          customerQualificationId: z
            .number()
            .int()
            .positive()
            .optional()
            .nullable(),
          needsReview: z
            .boolean()
            .optional()
            .nullable()
            .transform(v => (v ? 1 : 0)),
          recruitmentPermitFileKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          // Phase 2: 脩僱時間
          continuousEmploymentDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          employmentPeriodMonths: z
            .number()
            .int()
            .min(1)
            .max(36)
            .optional()
            .nullable(),
          terminationDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          // Phase 2: 代辦事項
          recruitmentAgencyItems: z
            .enum(["none", "self", "agency"])
            .optional()
            .nullable()
            .transform(v => v ?? undefined),
          employmentAgencyItems: z
            .enum(["none", "self", "agency"])
            .optional()
            .nullable()
            .transform(v => v ?? undefined),
          postEmploymentInsurance: z
            .enum(["none", "health", "accident", "both"])
            .optional()
            .nullable()
            .transform(v => v ?? undefined),
          // Phase 2: 脩僱許可函與情況
          employmentPermitFileKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          employmentStatus: z
            .enum(["normal", "suspended", "terminated", "transferred"])
            .optional()
            .nullable()
            .transform(v => v ?? undefined),
          terminationLetterFileKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          // Phase 3: 承接通報/入國通報
          notificationNo: z
            .string()
            .max(50)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          entryNotificationDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          certificateNo: z
            .string()
            .max(50)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          // Phase 3: 內政部移民署
          niaCategory: z
            .string()
            .max(50)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          niaNo: z
            .string()
            .max(50)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          residencePermitSubmitDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          // Phase 3: 勞動部脩僱許可函
          molReceiptNo: z
            .string()
            .max(50)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          employmentLetterCategory: z
            .string()
            .max(50)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          applicationSubmitDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          issuanceDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          approvalReceiptDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          // Phase 4: 保險管理
          healthInsurance: z
            .string()
            .max(200)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          healthInsurancePolicyKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          accidentInsurance: z
            .string()
            .max(200)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          accidentInsurancePolicyKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          // Phase 4: 體檢管理
          prevMedicalExamDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          prevMedicalReportKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          entryMedicalExamDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          entryMedicalReportKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          exam6mDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          exam6mReportKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          exam18mDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          exam18mReportKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          exam30mDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          exam30mReportKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          notes: z
            .string()
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
        })
      )
      .mutation(async ({ input }) => {
        // 自動產生案件編號：GVC25-YYYYMMDD-NNN
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
        const allCases = await getAllCases();
        const todayCases = allCases.filter(c => c.caseNo?.includes(dateStr));
        const seq = String(todayCases.length + 1).padStart(3, "0");
        const caseNo = `GVC25-${dateStr}-${seq}`;
        const id = await createCase({ ...input, caseNo });
        return { success: true, id, caseNo };
      }),
    update: staffProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          customerId: z.number().int().positive("客戶為必填"),
          name: z.string().trim().min(2, "案件名稱至少 2 字").max(100),
          managerId: z.number().int().positive("負責人為必填"),
          status: z.enum(["in_progress", "completed", "paused", "cancelled"]),
          caseCondition: z
            .string()
            .max(100)
            .optional()
            .transform(s => s?.trim() || undefined),
          primaryWorkerId: z.number().int().positive().optional().nullable(),
          careReceiverId: z.number().int().positive().optional().nullable(),
          customerQualificationId: z
            .number()
            .int()
            .positive()
            .optional()
            .nullable(),
          needsReview: z
            .boolean()
            .optional()
            .transform(v => (v ? 1 : 0)),
          recruitmentPermitFileKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          // Phase 2: 聘僱時間
          continuousEmploymentDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          employmentPeriodMonths: z
            .number()
            .int()
            .min(1)
            .max(36)
            .optional()
            .nullable(),
          terminationDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          // Phase 2: 代辦事項
          recruitmentAgencyItems: z
            .enum(["none", "self", "agency"])
            .optional()
            .nullable(),
          employmentAgencyItems: z
            .enum(["none", "self", "agency"])
            .optional()
            .nullable(),
          postEmploymentInsurance: z
            .enum(["none", "health", "accident", "both"])
            .optional()
            .nullable(),
          // Phase 2: 聘僱許可函與情況
          employmentPermitFileKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          employmentStatus: z
            .enum(["normal", "suspended", "terminated", "transferred"])
            .optional()
            .nullable(),
          terminationLetterFileKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          // Phase 3: 承接通報/入國通報
          notificationNo: z
            .string()
            .max(50)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          entryNotificationDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          certificateNo: z
            .string()
            .max(50)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          // Phase 3: 內政部移民署
          niaCategory: z
            .string()
            .max(50)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          niaNo: z
            .string()
            .max(50)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          residencePermitSubmitDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          // Phase 3: 勞動部聘僱許可函
          molReceiptNo: z
            .string()
            .max(50)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          employmentLetterCategory: z
            .string()
            .max(50)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          applicationSubmitDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          issuanceDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          approvalReceiptDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          // Phase 4: 保險管理
          healthInsurance: z
            .string()
            .max(200)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          healthInsurancePolicyKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          accidentInsurance: z
            .string()
            .max(200)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          accidentInsurancePolicyKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          // Phase 4: 體檢管理
          prevMedicalExamDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          prevMedicalReportKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          entryMedicalExamDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          entryMedicalReportKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          exam6mDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          exam6mReportKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          exam18mDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          exam18mReportKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          exam30mDate: z
            .string()
            .max(10)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          exam30mReportKey: z
            .string()
            .max(300)
            .optional()
            .nullable()
            .transform(s => s?.trim() || undefined),
          notes: z
            .string()
            .optional()
            .transform(s => s?.trim() || undefined),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateCase(id, data);
        return { success: true };
      }),
    delete: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteCase(input.id);
        return { success: true };
      }),
    getChildCounts: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => getCaseChildCounts(input.id)),
    // 公開站曝光：設定案件在找工作頁顯示的縣市（既有需求單去識別地點）。
    setPublicCity: staffProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          city: z
            .string()
            .trim()
            .max(20)
            .optional()
            .transform(s => s?.trim() || null),
        })
      )
      .mutation(async ({ input }) => {
        await setCasePublicCity(input.id, input.city);
        return { success: true };
      }),
  }),

  // ─── Case Qualifications Router ───────────────────────────────────────────
  caseQualifications: router({
    listByCase: staffProcedure
      .input(z.object({ caseId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const quals = await getQualificationsByCaseId(input.caseId);
        if (quals.length === 0) return [];
        // 批次取得所有資格的 quotaUsed（消除 N×2 查詢）
        const qualIds = quals.map(q => q.id);
        const quotaUsedMap = await getQuotaUsedBatch(qualIds);
        return quals.map(q => {
          const quotaUsed = quotaUsedMap.get(q.id) ?? 0;
          return { ...q, quotaUsed, quotaRemaining: q.quotaTotal - quotaUsed };
        });
      }),
    getById: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const q = await getQualificationById(input.id);
        if (!q)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此資格" });
        const quotaUsed = await getQuotaUsed(q.id);
        return { ...q, quotaUsed, quotaRemaining: q.quotaTotal - quotaUsed };
      }),
    create: staffProcedure
      .input(
        z.object({
          caseId: z.number().int().positive(),
          label: z.string().trim().min(1).max(100),
          category: z.enum(["labor_in", "labor_out", "professional"]),
          qualType: z.enum([
            "caregiver",
            "domestic_helper",
            "manufacturing",
            "agriculture",
            "construction",
            "white_collar",
            "intermediate",
            "overseas_student",
          ]),
          employerName: z
            .string()
            .max(100)
            .optional()
            .transform(s => s?.trim() || undefined),
          employerTaxId: z
            .string()
            .max(8)
            .optional()
            .transform(s => s?.trim() || undefined),
          employerNote: z
            .string()
            .optional()
            .transform(s => s?.trim() || undefined),
          applicationStatus: z
            .enum([
              "preparing",
              "submitted",
              "reviewing",
              "approved",
              "supplement",
              "rejected",
            ])
            .default("preparing"),
          expectedApprovalDate: z.string().optional(),
          quotaTotal: z.number().int().min(0).default(0),
          docValidUntil: z.string().optional(),
          notes: z
            .string()
            .optional()
            .transform(s => s?.trim() || undefined),
        })
      )
      .mutation(async ({ input }) => {
        const id = await createQualification(input);
        return { success: true, id };
      }),
    update: staffProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          label: z.string().trim().min(1).max(100),
          category: z.enum(["labor_in", "labor_out", "professional"]),
          qualType: z.enum([
            "caregiver",
            "domestic_helper",
            "manufacturing",
            "agriculture",
            "construction",
            "white_collar",
            "intermediate",
            "overseas_student",
          ]),
          employerName: z
            .string()
            .max(100)
            .optional()
            .transform(s => s?.trim() || undefined),
          employerTaxId: z
            .string()
            .max(8)
            .optional()
            .transform(s => s?.trim() || undefined),
          employerNote: z
            .string()
            .optional()
            .transform(s => s?.trim() || undefined),
          applicationStatus: z.enum([
            "preparing",
            "submitted",
            "reviewing",
            "approved",
            "supplement",
            "rejected",
          ]),
          expectedApprovalDate: z.string().optional(),
          quotaTotal: z.number().int().min(0),
          docValidUntil: z.string().optional(),
          notes: z
            .string()
            .optional()
            .transform(s => s?.trim() || undefined),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateQualification(id, data);
        return { success: true };
      }),
    delete: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteQualification(input.id);
        return { success: true };
      }),
  }),

  // ─── Case Demands Router ──────────────────────────────────────────────────
  caseDemands: router({
    listByCase: staffProcedure
      .input(z.object({ caseId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const demands = await getDemandsByCaseId(input.caseId);
        if (demands.length === 0) return [];
        const progressMap = await getDemandProgressBatch(
          demands.map(d => d.id)
        );
        return demands.map(d => {
          const { matchedCount, employedCount } = progressMap.get(d.id) ?? {
            matchedCount: 0,
            employedCount: 0,
          };
          const progress =
            d.neededCount > 0
              ? Math.round((matchedCount / d.neededCount) * 100)
              : 0;
          return { ...d, matchedCount, employedCount, progress };
        });
      }),
    create: staffProcedure
      .input(
        z.object({
          caseId: z.number().int().positive(),
          label: z.string().trim().min(1).max(100),
          qualificationId: z.number().int().positive().optional(),
          qualType: z.enum([
            "caregiver",
            "domestic_helper",
            "manufacturing",
            "agriculture",
            "construction",
            "white_collar",
            "intermediate",
            "overseas_student",
          ]),
          neededCount: z.number().int().min(1),
          status: z
            .enum(["open", "filling", "fulfilled", "closed"])
            .default("open"),
          notes: z
            .string()
            .optional()
            .transform(s => s?.trim() || undefined),
        })
      )
      .mutation(async ({ input }) => {
        const id = await createDemand(input);
        return { success: true, id };
      }),
    update: staffProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          label: z.string().trim().min(1).max(100),
          qualificationId: z.number().int().positive().optional(),
          qualType: z.enum([
            "caregiver",
            "domestic_helper",
            "manufacturing",
            "agriculture",
            "construction",
            "white_collar",
            "intermediate",
            "overseas_student",
          ]),
          neededCount: z.number().int().min(1),
          status: z.enum(["open", "filling", "fulfilled", "closed"]),
          notes: z
            .string()
            .optional()
            .transform(s => s?.trim() || undefined),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateDemand(id, data);
        return { success: true };
      }),
    delete: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteDemand(input.id);
        return { success: true };
      }),
    // 公開站曝光控制：逐筆隱藏/顯示既有需求單（規格 §11、使用者定案）。
    setPublicHidden: staffProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          hidden: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        await setDemandPublicHidden(input.id, input.hidden);
        return { success: true };
      }),
  }),

  // ─── Case Assignments Router ──────────────────────────────────────────────
  caseAssignments: router({
    listByCase: staffProcedure
      .input(
        z.object({
          caseId: z.number().int().positive(),
          stage: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        const [assignments, allMembers, allWorkers] = await Promise.all([
          getAssignmentsByCaseId(input.caseId),
          getMembersByCaseId(input.caseId),
          getAllWorkers(),
        ]);
        const workerMap = new Map(allWorkers.map(w => [w.id, w]));
        // 依 assignmentId 分組成員（一次查詢取代逐一查詢，消除 N+1）
        const membersByAssignment = new Map<number, typeof allMembers>();
        for (const m of allMembers) {
          const list = membersByAssignment.get(m.assignmentId) ?? [];
          list.push(m);
          membersByAssignment.set(m.assignmentId, list);
        }
        return assignments.map(a => {
          const members = membersByAssignment.get(a.id) ?? [];
          const enrichedMembers = members
            .filter(m => !input.stage || m.stage === input.stage)
            .map(m => ({
              ...m,
              workerName: workerMap.get(m.workerId)?.name ?? "",
              workerNameEn: workerMap.get(m.workerId)?.nameEn ?? "",
              workerNationality: workerMap.get(m.workerId)?.nationality ?? "",
              workerPermitNo:
                workerMap.get(m.workerId)?.residentPermitNo ??
                workerMap.get(m.workerId)?.passportNo ??
                "",
              workerLifecycleStatus:
                workerMap.get(m.workerId)?.lifecycleStatus ?? "",
            }));
          return { ...a, members: enrichedMembers };
        });
      }),
    create: staffProcedure
      .input(
        z.object({
          caseId: z.number().int().positive(),
          label: z.string().max(100).optional(),
          demandId: z.number().int().positive().optional(),
          qualificationId: z.number().int().positive().optional(),
          batchNote: z.string().optional(),
          notes: z.string().optional(),
          workerIds: z
            .array(z.number().int().positive())
            .min(1, "至少選擇一位移工"),
        })
      )
      .mutation(async ({ input }) => {
        const { workerIds, ...assignmentData } = input;
        // 唯一性檢查：同案件同移工只能一筆非終態成員
        const existingMembers = await getMembersByCaseId(input.caseId);
        const activeWorkerIds = new Set(
          existingMembers
            .filter(m =>
              (ACTIVE_MEMBER_STAGES as readonly string[]).includes(m.stage)
            )
            .map(m => m.workerId)
        );
        const conflicts = workerIds.filter(wid => activeWorkerIds.has(wid));
        if (conflicts.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `此移工已在本案件配對中（workerId: ${conflicts.join(", ")}）`,
          });
        }
        // 建立配對
        const assignmentId = await createAssignment(assignmentData);
        // 建立成員
        for (const workerId of workerIds) {
          await createMember({
            assignmentId,
            caseId: input.caseId,
            workerId,
            stage: "candidate",
          });
        }
        return { success: true, assignmentId };
      }),
    update: staffProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          label: z.string().max(100).optional(),
          demandId: z.number().int().positive().optional(),
          qualificationId: z.number().int().positive().optional(),
          batchNote: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateAssignment(id, data);
        return { success: true };
      }),
    delete: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteAssignment(input.id);
        return { success: true };
      }),
    addWorker: staffProcedure
      .input(
        z.object({
          assignmentId: z.number().int().positive(),
          workerId: z.number().int().positive(),
        })
      )
      .mutation(async ({ input }) => {
        const assignment = await getAssignmentById(input.assignmentId);
        if (!assignment)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此配對" });
        const existingMembers = await getMembersByCaseId(assignment.caseId);
        const conflict = existingMembers.find(
          m =>
            m.workerId === input.workerId &&
            (ACTIVE_MEMBER_STAGES as readonly string[]).includes(m.stage)
        );
        if (conflict)
          throw new TRPCError({
            code: "CONFLICT",
            message: "此移工已在本案件配對中",
          });
        await createMember({
          assignmentId: input.assignmentId,
          caseId: assignment.caseId,
          workerId: input.workerId,
          stage: "candidate",
        });
        return { success: true };
      }),
    updateMember: staffProcedure
      .input(
        z.object({
          memberId: z.number().int().positive(),
          matchNote: z.string().optional(),
          expectedDocDate: z.string().optional(),
          expectedEntryDate: z.string().optional(),
          departureNote: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { memberId, ...data } = input;
        await updateMember(memberId, data);
        return { success: true };
      }),
    updateMemberStage: staffProcedure
      .input(
        z.object({
          memberId: z.number().int().positive(),
          stage: z.enum([
            "candidate",
            "confirmed",
            "upcoming",
            "employed",
            "departed",
            "rejected",
          ]),
        })
      )
      .mutation(async ({ input }) => {
        // 改回「有效」階段時要重新檢查不變量。否則會有這個漏洞：
        // 誤標成離退 → 系統允許重新配對同一位移工 → 發現標錯又改回在職
        // → 同案件出現兩筆該移工的有效紀錄。UI 的階段下拉是開放選單，
        // 任何階段都能互選，所以這是正常操作就會踩到的情境。
        const isActive = (ACTIVE_MEMBER_STAGES as readonly string[]).includes(
          input.stage
        );
        if (isActive) {
          const member = await getMemberById(input.memberId);
          if (!member)
            throw new TRPCError({ code: "NOT_FOUND", message: "找不到此成員" });
          const siblings = await getMembersByCaseId(member.caseId);
          const conflict = siblings.find(
            m =>
              m.id !== input.memberId &&
              m.workerId === member.workerId &&
              (ACTIVE_MEMBER_STAGES as readonly string[]).includes(m.stage)
          );
          if (conflict) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "此移工在本案件已有另一筆有效配對，無法改回此階段",
            });
          }
        }
        await updateMember(input.memberId, { stage: input.stage });
        return { success: true };
      }),
    removeWorker: staffProcedure
      .input(z.object({ memberId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteMember(input.memberId);
        return { success: true };
      }),
    workerInvolvements: staffProcedure
      .input(
        z.object({ excludeCaseId: z.number().int().positive().optional() })
      )
      .query(async ({ input }) => {
        const members = await getWorkerInvolvements(input.excludeCaseId);
        const allCases = await getAllCases();
        const allCustomers = await getAllCustomers();
        const allWorkers = await getAllWorkers();
        const caseMap = new Map(allCases.map(c => [c.id, c]));
        const customerMap = new Map(allCustomers.map(c => [c.id, c]));
        const workerMap = new Map(allWorkers.map(w => [w.id, w]));
        return members.map(m => {
          const caseItem = caseMap.get(m.caseId);
          const customerId = caseItem?.customerId ?? 0;
          const workerItem = workerMap.get(m.workerId);
          return {
            workerId: m.workerId,
            workerName:
              workerItem?.nameCn ||
              workerItem?.nameEn ||
              workerItem?.name ||
              "",
            caseId: m.caseId,
            caseName: caseItem?.name ?? "",
            customerId,
            customerName: customerMap.get(customerId)?.name ?? "",
            stage: m.stage,
          };
        });
      }),
    getMembersByCaseId: staffProcedure
      .input(z.object({ caseId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const members = await getMembersByCaseId(input.caseId);
        const allWorkers = await getAllWorkers();
        const workerMap = new Map(allWorkers.map(w => [w.id, w]));
        return members.map(m => ({
          ...m,
          workerName: workerMap.get(m.workerId)?.name ?? "",
          workerNameEn: workerMap.get(m.workerId)?.nameEn ?? "",
          workerNationality: workerMap.get(m.workerId)?.nationality ?? "",
          workerPermitNo:
            workerMap.get(m.workerId)?.residentPermitNo ??
            workerMap.get(m.workerId)?.passportNo ??
            "",
          workerLifecycleStatus:
            workerMap.get(m.workerId)?.lifecycleStatus ?? "",
        }));
      }),
  }),
  caseEmployments: router({
    listByCase: staffProcedure
      .input(z.object({ caseId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const emps = await getEmploymentsByCase(input.caseId);
        const allWorkers = await getAllWorkers();
        const quals = await getQualificationsByCaseId(input.caseId);
        const workerMap = new Map(allWorkers.map(w => [w.id, w]));
        const qualMap = new Map(
          quals.map((q: { id: number; label: string }) => [q.id, q])
        );
        return emps.map(e => ({
          ...e,
          workerName: workerMap.get(e.workerId)?.name ?? "",
          workerNameEn: workerMap.get(e.workerId)?.nameEn ?? "",
          qualificationLabel: e.qualificationId
            ? ((qualMap.get(e.qualificationId) as any)?.label ?? "")
            : "",
        }));
      }),
    create: staffProcedure
      .input(
        z.object({
          caseId: z.number().int().positive(),
          workerId: z.number().int().positive(),
          qualificationId: z.number().int().positive().optional(),
          position: z.string().max(100).optional(),
          contractStart: z.string().max(10).optional(),
          contractEnd: z.string().max(10).optional(),
          status: z
            .enum(["pending", "active", "terminated", "expired"])
            .default("pending"),
          terminationReason: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await createEmployment({
          caseId: input.caseId,
          workerId: input.workerId,
          qualificationId: input.qualificationId ?? null,
          position: input.position ?? null,
          contractStart: input.contractStart ?? null,
          contractEnd: input.contractEnd ?? null,
          status: input.status,
          terminationReason: input.terminationReason ?? null,
          notes: input.notes ?? null,
        });
        return { success: true, id };
      }),
    update: staffProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          workerId: z.number().int().positive().optional(),
          qualificationId: z.number().int().positive().optional(),
          position: z.string().max(100).optional(),
          contractStart: z.string().max(10).optional(),
          contractEnd: z.string().max(10).optional(),
          status: z
            .enum(["pending", "active", "terminated", "expired"])
            .optional(),
          terminationReason: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateEmployment(id, {
          ...data,
          qualificationId: data.qualificationId ?? null,
          position: data.position ?? null,
          contractStart: data.contractStart ?? null,
          contractEnd: data.contractEnd ?? null,
          terminationReason: data.terminationReason ?? null,
          notes: data.notes ?? null,
        });
        return { success: true };
      }),
    delete: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteEmployment(input.id);
        return { success: true };
      }),
  }),

  // ─── 雇主自助：需求單張貼（P1）────────────────────────────────────────────
  // employerProcedure：需登入且 accountType=employer（staff/admin 亦可代操作）。
  employer: router({
    // 自己的需求單列表
    myPostings: employerProcedure.query(async ({ ctx }) =>
      getJobPostingsByEmployer(ctx.user.id)
    ),
    // 自己的單筆需求單（含編輯用）
    getPosting: employerProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const p = await getJobPostingById(input.id);
        if (!p || p.employerUserId !== ctx.user.id)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此需求單" });
        return p;
      }),
    // 建立需求單（submit=true 直接送審，否則存草稿）
    createPosting: employerProcedure
      .input(jobPostingInput.extend({ submit: z.boolean().default(true) }))
      .mutation(async ({ ctx, input }) => {
        const { submit, ...data } = input;
        const status = submit ? "pending_review" : "draft";
        const id = await createJobPosting({
          employerUserId: ctx.user.id,
          customerId: ctx.user.customerId ?? null,
          jobType: data.jobType,
          city: data.city,
          district: data.district ?? null,
          headcount: data.headcount,
          employmentType: data.employmentType,
          requirements: data.requirements ?? null,
          publicDescription: data.publicDescription ?? null,
          salaryMin: data.salaryMin ?? null,
          salaryMax: data.salaryMax ?? null,
          expectedStartDate: data.expectedStartDate ?? null,
          status,
        });
        if (submit) {
          await insertModerationEvent({
            entityType: "job_posting",
            entityId: id,
            action: "submit",
            staffId: null, // submit 為雇主動作，非 staff 審核
          });
        }
        await logAudit(ctx, {
          action: "employer.posting.create",
          entityType: "job_postings",
          entityId: id,
          meta: { status },
        });
        return { success: true, id, status } as const;
      }),
    // 編輯需求單（僅 draft / rejected 可改）；submit=true 送審
    updatePosting: employerProcedure
      .input(
        jobPostingInput.extend({
          id: z.number().int().positive(),
          submit: z.boolean().default(false),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, submit, ...data } = input;
        const existing = await getJobPostingById(id);
        if (!existing || existing.employerUserId !== ctx.user.id)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此需求單" });
        if (existing.status !== "draft" && existing.status !== "rejected")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "此需求單目前狀態不可編輯",
          });
        const status = submit ? "pending_review" : existing.status;
        await updateJobPosting(id, {
          jobType: data.jobType,
          city: data.city,
          district: data.district ?? null,
          headcount: data.headcount,
          employmentType: data.employmentType,
          requirements: data.requirements ?? null,
          publicDescription: data.publicDescription ?? null,
          salaryMin: data.salaryMin ?? null,
          salaryMax: data.salaryMax ?? null,
          expectedStartDate: data.expectedStartDate ?? null,
          status,
          rejectReason: submit ? null : existing.rejectReason,
        });
        if (submit) {
          await insertModerationEvent({
            entityType: "job_posting",
            entityId: id,
            action: "submit",
            staffId: null, // submit 為雇主動作，非 staff 審核
          });
        }
        await logAudit(ctx, {
          action: "employer.posting.update",
          entityType: "job_postings",
          entityId: id,
          meta: { status },
        });
        return { success: true, status } as const;
      }),
  }),

  // ─── 審核佇列：需求單審核（P1，staff）─────────────────────────────────────
  moderation: router({
    // 待審需求單（附雇主帳號資訊供審核判斷）
    pendingPostings: staffProcedure.query(async () => {
      const postings = await getPendingJobPostings();
      return Promise.all(
        postings.map(async p => {
          const employer = await getUserById(p.employerUserId);
          return {
            ...p,
            employerName: employer?.name ?? null,
            employerEmail: employer?.email ?? null,
          };
        })
      );
    }),
    // 通過 → 自動建立 case + 資格 + 需求，並回連（規格 §2-G、§7.3、§10）
    approvePosting: staffProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          managerId: z.number().int().positive("請指派負責人"),
          caseName: z
            .string()
            .trim()
            .max(100)
            .optional()
            .transform(s => s?.trim() || undefined),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const posting = await getJobPostingById(input.id);
        if (!posting)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此需求單" });
        if (posting.status !== "pending_review")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "此需求單非待審狀態，無法審核",
          });

        // 原子搶佔：把狀態標成 approved。兩個 staff 同時通過時只有一個搶得到，
        // 另一個 claimed=false → 擋下，避免重複建立 case。
        const claimed = await claimJobPostingForApproval(input.id);
        if (!claimed)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "此需求單已被處理，請重新整理",
          });

        try {
          // 1) 決定雇主 customer：已勾稽用既有；否則自動建立一筆待驗證雇主 stub
          let customerId = posting.customerId;
          if (!customerId) {
            const employer = await getUserById(posting.employerUserId);
            customerId = await createCustomer({
              employerType: "company",
              name: employer?.name || `公開站雇主 #${posting.employerUserId}`,
              contractStatus: "negotiating",
              pricingTier: "standard",
              managerId: input.managerId,
              notes: "由公開站需求單審核通過時自動建立（待客服勾稽/驗證）。",
            });
          }

          // 2) 建立案件（帶入公開縣市，供找工作頁顯示地點）
          const jobLabel = QUAL_TYPE_LABEL[posting.jobType];
          const caseName = input.caseName || `${jobLabel}－${posting.city}`;
          const caseId = await createCase({
            customerId,
            name: caseName,
            managerId: input.managerId,
            status: "in_progress",
            publicCity: posting.city,
          });

          // 3) 建立案件資格 + 媒合需求。
          //    這張 demand 於公開站隱藏（publicHidden=1）：此職缺已由 job_posting
          //    以 source="posting" 呈現；若 demand 也曝光會在找工作頁重複一張卡。
          const qualId = await createQualification({
            caseId,
            label: `${jobLabel}（公開需求單）`,
            category: inferQualCategory(posting.jobType),
            qualType: posting.jobType,
            quotaTotal: posting.headcount,
            applicationStatus: "preparing",
          });
          await createDemand({
            caseId,
            label: `${jobLabel}－${posting.city}`,
            qualificationId: qualId,
            qualType: posting.jobType,
            neededCount: posting.headcount,
            status: "open",
            publicHidden: 1,
          });

          // 4) 回填 case 連結與上架時間（狀態已於 claim 設為 approved）
          await updateJobPosting(input.id, {
            caseId,
            publishedAt: new Date(),
            rejectReason: null,
          });
          await insertModerationEvent({
            entityType: "job_posting",
            entityId: input.id,
            action: "approve",
            staffId: ctx.user.id,
          });
          await logAudit(ctx, {
            action: "moderation.posting.approve",
            entityType: "job_postings",
            entityId: input.id,
            meta: { caseId, customerId },
          });
          return { success: true, caseId } as const;
        } catch (err) {
          // 建 case 中途失敗 → 還原成待審，讓此單可重新審核（best-effort）。
          await updateJobPosting(input.id, { status: "pending_review" }).catch(
            () => {}
          );
          throw err;
        }
      }),
    // 退件（附結構化理由 + 補正說明；雇主可修改後重送）
    rejectPosting: staffProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          reasonCode: z.enum([
            "incomplete", // 資料不全
            "illegal_content", // 違規文案
            "illegal_terms", // 條件不合法
            "duplicate", // 重複張貼
            "other", // 其他
          ]),
          note: z
            .string()
            .trim()
            .max(280)
            .optional()
            .transform(s => s?.trim() || undefined),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const posting = await getJobPostingById(input.id);
        if (!posting)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此需求單" });
        if (posting.status !== "pending_review")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "此需求單非待審狀態，無法退件",
          });
        const reason = input.note
          ? `${input.reasonCode}:${input.note}`
          : input.reasonCode;
        await updateJobPosting(input.id, {
          status: "rejected",
          rejectReason: reason.slice(0, 300),
        });
        await insertModerationEvent({
          entityType: "job_posting",
          entityId: input.id,
          action: "reject",
          reason,
          staffId: ctx.user.id,
        });
        await logAudit(ctx, {
          action: "moderation.posting.reject",
          entityType: "job_postings",
          entityId: input.id,
          meta: { reasonCode: input.reasonCode },
        });
        return { success: true } as const;
      }),

    // ── 移工履歷審核（P2）────────────────────────────────────────────────────
    // 待審履歷（附發起者去識別摘要 + 帳號 email 供勾稽）
    pendingProfiles: staffProcedure.query(async () => {
      const rows = await getPendingProfiles();
      return Promise.all(
        rows.map(async p => {
          const u = await getUserById(p.userId);
          return {
            id: p.id,
            userId: p.userId,
            alias: p.alias,
            headline: p.headline,
            nationality: p.nationality,
            jobType: p.jobType,
            availability: p.availability,
            selfIntro: p.selfIntro,
            accountEmail: u?.email ?? null,
            accountName: u?.name ?? null,
          };
        })
      );
    }),
    approveProfile: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const p = await getProfileById(input.id);
        if (!p)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此履歷" });
        await updateProfile(input.id, {
          moderationStatus: "approved",
          rejectReason: null,
        });
        await insertModerationEvent({
          entityType: "worker_profile",
          entityId: input.id,
          action: "approve",
          staffId: ctx.user.id,
        });
        await logAudit(ctx, {
          action: "moderation.profile.approve",
          entityType: "worker_public_profiles",
          entityId: input.id,
        });
        return { success: true } as const;
      }),
    rejectProfile: staffProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          reason: z
            .string()
            .trim()
            .max(300)
            .optional()
            .transform(s => s?.trim() || undefined),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const p = await getProfileById(input.id);
        if (!p)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此履歷" });
        await updateProfile(input.id, {
          moderationStatus: "rejected",
          rejectReason: input.reason ?? null,
        });
        await insertModerationEvent({
          entityType: "worker_profile",
          entityId: input.id,
          action: "reject",
          reason: input.reason,
          staffId: ctx.user.id,
        });
        await logAudit(ctx, {
          action: "moderation.profile.reject",
          entityType: "worker_public_profiles",
          entityId: input.id,
        });
        return { success: true } as const;
      }),

    // ── 自填經歷審核（P2）────────────────────────────────────────────────────
    pendingExperiences: staffProcedure.query(async () => {
      const rows = await getPendingExperiences();
      return Promise.all(
        rows.map(async e => {
          const u = await getUserById(e.userId);
          return {
            ...e,
            createdAt: e.createdAt?.toISOString() ?? null,
            updatedAt: e.updatedAt?.toISOString() ?? null,
            accountEmail: u?.email ?? null,
            accountName: u?.name ?? null,
          };
        })
      );
    }),
    reviewExperience: staffProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          approve: z.boolean(),
          reason: z
            .string()
            .trim()
            .max(300)
            .optional()
            .transform(s => s?.trim() || undefined),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const e = await getExperienceById(input.id);
        if (!e)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此經歷" });
        await updateExperience(input.id, {
          reviewStatus: input.approve ? "approved" : "rejected",
          rejectReason: input.approve ? null : (input.reason ?? null),
        });
        await insertModerationEvent({
          entityType: "worker_experience",
          entityId: input.id,
          action: input.approve ? "approve" : "reject",
          reason: input.approve ? undefined : input.reason,
          staffId: ctx.user.id,
        });
        await logAudit(ctx, {
          action: input.approve
            ? "moderation.experience.approve"
            : "moderation.experience.reject",
          entityType: "worker_experiences",
          entityId: input.id,
        });
        return { success: true } as const;
      }),
  }),

  // ─── 公開站：找工作（P1）──────────────────────────────────────────────────
  // 瀏覽（list/get）開放匿名 → publicProcedure：職缺卡片已去識別，不含任何雇主
  // PII，開放瀏覽利於引流／SEO 且不損隱私。表達興趣（expressInterest）與「我的
  // 意向」仍需登入。統一呈現兩個來源：① 審核通過的公開需求單；② 既有內部需求單中
  // 尚未媒合成功且未被隱藏者。
  publicJobs: router({
    list: publicProcedure
      .input(
        z
          .object({
            category: z
              .enum(["caregiver", "domestic_helper", "other"])
              .optional(),
            city: z.string().trim().max(20).optional(),
            employmentType: z
              .enum(["live_in", "live_out", "institution", "other"])
              .optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const [postings, demands] = await Promise.all([
          listApprovedJobPostings(),
          listPublicOpenDemands(),
        ]);
        type Card = {
          source: "posting" | "demand";
          refId: number;
          category: "caregiver" | "domestic_helper" | "other";
          jobType: string;
          city: string | null;
          district: string | null;
          employmentType: string | null;
          headcount: number;
          publicDescription: string | null;
          salaryMin: number | null;
          salaryMax: number | null;
          postedAt: string | null;
        };
        const cards: Card[] = [];
        for (const p of postings) {
          cards.push({
            source: "posting",
            refId: p.id,
            category: jobCategory(p.jobType),
            jobType: p.jobType,
            city: p.city,
            district: p.district,
            employmentType: p.employmentType,
            headcount: p.headcount,
            publicDescription: p.publicDescription,
            salaryMin: p.salaryMin,
            salaryMax: p.salaryMax,
            postedAt: (p.publishedAt ?? p.createdAt)?.toISOString() ?? null,
          });
        }
        for (const d of demands) {
          cards.push({
            source: "demand",
            refId: d.id,
            category: jobCategory(d.qualType),
            jobType: d.qualType,
            city: d.publicCity,
            district: null,
            employmentType: null,
            headcount: d.neededCount,
            publicDescription: null,
            salaryMin: null,
            salaryMax: null,
            postedAt: d.createdAt?.toISOString() ?? null,
          });
        }
        const filtered = cards.filter(c => {
          if (input?.category && c.category !== input.category) return false;
          if (input?.city && c.city !== input.city) return false;
          if (
            input?.employmentType &&
            c.employmentType !== input.employmentType
          )
            return false;
          return true;
        });
        filtered.sort((a, b) =>
          (b.postedAt ?? "").localeCompare(a.postedAt ?? "")
        );
        return filtered;
      }),
    // 單筆職缺詳情（開放匿名瀏覽；仍不外露雇主 PII）
    get: publicProcedure
      .input(
        z.object({
          source: z.enum(["posting", "demand"]),
          id: z.number().int().positive(),
        })
      )
      .query(async ({ input }) => {
        if (input.source === "posting") {
          const p = await getJobPostingById(input.id);
          if (!p || p.status !== "approved")
            throw new TRPCError({ code: "NOT_FOUND", message: "找不到此職缺" });
          return {
            source: "posting" as const,
            refId: p.id,
            category: jobCategory(p.jobType),
            jobType: p.jobType,
            city: p.city,
            district: p.district,
            employmentType: p.employmentType,
            headcount: p.headcount,
            requirements: p.requirements,
            publicDescription: p.publicDescription,
            salaryMin: p.salaryMin,
            salaryMax: p.salaryMax,
            expectedStartDate: p.expectedStartDate,
            postedAt: (p.publishedAt ?? p.createdAt)?.toISOString() ?? null,
          };
        }
        const d = await getDemandById(input.id);
        if (
          !d ||
          d.publicHidden === 1 ||
          !["open", "filling"].includes(d.status)
        )
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此職缺" });
        const c = await getCaseById(d.caseId);
        return {
          source: "demand" as const,
          refId: d.id,
          category: jobCategory(d.qualType),
          jobType: d.qualType,
          city: c?.publicCity ?? null,
          district: null,
          employmentType: null,
          headcount: d.neededCount,
          requirements: null,
          publicDescription: null,
          salaryMin: null,
          salaryMax: null,
          expectedStartDate: null,
          postedAt: d.createdAt?.toISOString() ?? null,
        };
      }),
    // 「我有興趣」：P1 先記錄意向（稽核）；仲介居中的完整媒合流程於 P3。
    // 「我有興趣」→ 建立一筆媒合意向（match_request），交客服居中處理（P3）。
    // 雙方看不到彼此私密聯絡資訊；同一使用者對同一標的若已有進行中的意向則不重複建立。
    expressInterest: protectedProcedure
      .input(
        z.object({
          source: z.enum(["posting", "demand"]),
          id: z.number().int().positive(),
          note: z
            .string()
            .trim()
            .max(500)
            .optional()
            .transform(s => s?.trim() || undefined),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const targetType =
          input.source === "posting" ? "job_posting" : "case_demand";

        // 標的必須「目前正對外公開」才可送意向 —— 用與找工作列表相同的可見度條件，
        // 否則使用者可對 draft/rejected 需求單或已隱藏/已滿的需求送意向，並透過
        // 「我的意向」反推非公開標的的資訊，或當成存在性探測（enumeration）。
        let visible = false;
        if (targetType === "job_posting") {
          const p = await getJobPostingById(input.id);
          visible = !!p && p.status === "approved";
        } else {
          const d = await getDemandById(input.id);
          visible =
            !!d &&
            d.publicHidden === 0 &&
            (d.status === "open" || d.status === "filling");
        }
        if (!visible)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此職缺" });

        // 去重：同一人對同一標的已有進行中的意向就不再建立
        const existing = await getOpenMatchRequest(
          ctx.user.id,
          targetType,
          input.id
        );
        if (existing) {
          return { success: true, alreadySent: true } as const;
        }

        const initiatorType =
          ctx.user.accountType === "worker"
            ? "worker"
            : ctx.user.accountType === "employer"
              ? "employer"
              : "other";
        const matchId = await createMatchRequest({
          initiatorUserId: ctx.user.id,
          initiatorType,
          targetType,
          targetId: input.id,
          status: "new",
          note: input.note ?? null,
        });
        await logAudit(ctx, {
          action: "match.request.create",
          entityType: "match_requests",
          entityId: matchId,
          meta: { targetType, targetId: input.id },
        });
        return { success: true, alreadySent: false } as const;
      }),

    // 「我的意向」：發起者看自己送出過的媒合意向與目前狀態。
    myInterests: protectedProcedure.query(async ({ ctx }) => {
      const rows = await getMatchRequestsByInitiator(ctx.user.id);
      return Promise.all(
        rows.map(async r => {
          const summary = await resolveMatchTargetSummary(
            r.targetType,
            r.targetId
          );
          return {
            id: r.id,
            status: r.status,
            note: r.note,
            createdAt: r.createdAt?.toISOString() ?? null,
            targetType: r.targetType,
            targetId: r.targetId,
            jobType: summary?.jobType ?? null,
            city: summary?.city ?? null,
            category: summary?.jobType
              ? jobCategory(summary.jobType as MarketplaceQualType)
              : null,
          };
        })
      );
    }),
  }),

  // ─── 移工自助：公開履歷 + 自填經歷（P2）──────────────────────────────────
  // workerProcedure：需登入且 accountType=worker（staff/admin 亦可代操作）。
  worker: router({
    // 自己的履歷（含審核狀態）；未建立則回 null。
    myProfile: workerProcedure.query(async ({ ctx }) => {
      const p = await getProfileByUserId(ctx.user.id);
      if (!p) return null;
      return {
        ...p,
        skills: parseJsonArray(p.skills),
        languages: parseJsonArray(p.languages),
        createdAt: p.createdAt?.toISOString() ?? null,
        updatedAt: p.updatedAt?.toISOString() ?? null,
      };
    }),
    // 建立/更新履歷；submit=true 送審（moderationStatus → pending）。
    upsertProfile: workerProcedure
      .input(workerProfileInput.extend({ submit: z.boolean().default(false) }))
      .mutation(async ({ ctx, input }) => {
        const { submit, skills, languages, ...rest } = input;
        const existing = await getProfileByUserId(ctx.user.id);
        const data = {
          ...rest,
          skills: skills ? JSON.stringify(skills) : undefined,
          languages: languages ? JSON.stringify(languages) : undefined,
          // 任何內容編輯都必須重新審核 —— 否則已通過的履歷可透過「存草稿」把
          // 真實姓名/電話塞進 selfIntro 而不經審核就對雇主公開（Code Review #2）。
          // 已公開者一旦編輯即退回 pending，於重新通過前不再出現在找移工。
          moderationStatus: "pending" as const,
          publishStatus: submit
            ? ("published" as const)
            : (existing?.publishStatus ?? ("draft" as const)),
          rejectReason: null,
        };
        let id: number;
        if (existing) {
          await updateProfile(existing.id, data);
          id = existing.id;
        } else {
          id = await createProfile({ userId: ctx.user.id, ...data });
        }
        if (submit) {
          await insertModerationEvent({
            entityType: "worker_profile",
            entityId: id,
            action: "submit",
            staffId: null,
          });
        }
        await logAudit(ctx, {
          action: "worker.profile.upsert",
          entityType: "worker_public_profiles",
          entityId: id,
          meta: { submit },
        });
        return { success: true, id, submitted: submit } as const;
      }),
    // 自填經歷（自己的全部，含審核狀態）
    myExperiences: workerProcedure.query(async ({ ctx }) => {
      const rows = await getExperiencesByUserId(ctx.user.id);
      return rows.map(e => ({
        ...e,
        createdAt: e.createdAt?.toISOString() ?? null,
        updatedAt: e.updatedAt?.toISOString() ?? null,
      }));
    }),
    addExperience: workerProcedure
      .input(workerExperienceInput)
      .mutation(async ({ ctx, input }) => {
        const id = await createExperience({
          userId: ctx.user.id,
          employerType: input.employerType,
          role: input.role,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
          description: input.description ?? null,
        });
        await insertModerationEvent({
          entityType: "worker_experience",
          entityId: id,
          action: "submit",
          staffId: null,
        });
        return { success: true, id } as const;
      }),
    updateExperience: workerProcedure
      .input(workerExperienceInput.extend({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const e = await getExperienceById(id);
        if (!e || e.userId !== ctx.user.id)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此經歷" });
        // 編輯後回到待審
        await updateExperience(id, {
          employerType: data.employerType,
          role: data.role,
          startDate: data.startDate ?? null,
          endDate: data.endDate ?? null,
          description: data.description ?? null,
          reviewStatus: "pending",
          rejectReason: null,
        });
        return { success: true } as const;
      }),
    deleteExperience: workerProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const e = await getExperienceById(input.id);
        if (!e || e.userId !== ctx.user.id)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此經歷" });
        await deleteExperience(input.id);
        return { success: true } as const;
      }),
  }),

  // ─── 找移工（P2）─────────────────────────────────────────────────────────
  // 瀏覽（list/get）開放匿名 → publicProcedure：一律回去識別視圖，永不外露移工
  // 真實姓名/證件/聯絡方式（§11），故匿名瀏覽不損隱私。送出媒合意向
  // （expressInterest）仍需雇主登入 **且** 至少一張通過審核的需求單（§15-1，
  // 見 assertCanBrowseWorkers）。
  findWorkers: router({
    list: publicProcedure
      .input(
        z
          .object({
            jobType: z
              .enum([
                "caregiver",
                "domestic_helper",
                "manufacturing",
                "agriculture",
                "construction",
                "white_collar",
                "intermediate",
                "overseas_student",
              ])
              .optional(),
            nationality: z.string().trim().max(50).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const rows = await listPublicProfiles(input);
        return rows.map(publicProfileView);
      }),
    get: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const p = await getProfileById(input.id);
        if (
          !p ||
          p.publishStatus !== "published" ||
          p.moderationStatus !== "approved"
        )
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此履歷" });
        // 平台可信工作紀錄（僅在客服已勾稽 workerId 時有；去識別）
        const platformRecords = p.workerId
          ? await getEmploymentsByWorker(p.workerId)
          : [];
        const experiences = await getApprovedExperiencesByUserId(p.userId);
        return {
          ...publicProfileView(p),
          platformRecords,
          experiences: experiences.map(e => ({
            id: e.id,
            employerType: e.employerType,
            role: e.role,
            startDate: e.startDate,
            endDate: e.endDate,
            description: e.description,
          })),
        };
      }),
    // 「送出媒合意向」→ match_request（targetType=worker），交客服居中。
    expressInterest: employerProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          note: z
            .string()
            .trim()
            .max(500)
            .optional()
            .transform(s => s?.trim() || undefined),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await assertCanBrowseWorkers(ctx.user); // §15-1：送出意向前仍需通過的需求單
        const p = await getProfileById(input.id);
        if (
          !p ||
          p.publishStatus !== "published" ||
          p.moderationStatus !== "approved"
        )
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此履歷" });
        const existing = await getOpenMatchRequest(
          ctx.user.id,
          "worker",
          input.id
        );
        if (existing) return { success: true, alreadySent: true } as const;
        const matchId = await createMatchRequest({
          initiatorUserId: ctx.user.id,
          initiatorType: "employer",
          targetType: "worker",
          targetId: input.id,
          status: "new",
          note: input.note ?? null,
        });
        await logAudit(ctx, {
          action: "match.request.create",
          entityType: "match_requests",
          entityId: matchId,
          meta: { targetType: "worker", targetId: input.id },
        });
        return { success: true, alreadySent: false } as const;
      }),
  }),

  // ─── 客服：媒合意向佇列（仲介居中，P3）───────────────────────────────────
  matchRequests: router({
    // 佇列：可依狀態過濾；附發起者聯絡資訊（客服可見）與標的去識別摘要。
    queue: staffProcedure
      .input(
        z
          .object({
            status: z
              .enum([
                "new",
                "staff_handling",
                "introduced",
                "matched",
                "closed",
              ])
              .optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const rows = await getAllMatchRequests(input?.status);
        return Promise.all(
          rows.map(async r => {
            const [initiator, summary] = await Promise.all([
              getUserById(r.initiatorUserId),
              resolveMatchTargetSummary(r.targetType, r.targetId),
            ]);
            return {
              ...r,
              createdAt: r.createdAt?.toISOString() ?? null,
              updatedAt: r.updatedAt?.toISOString() ?? null,
              initiatorName: initiator?.name ?? null,
              initiatorEmail: initiator?.email ?? null,
              initiatorPhone: initiator?.phone ?? null,
              targetJobType: summary?.jobType ?? null,
              targetCity: summary?.city ?? null,
              targetLabel: summary?.label ?? null,
            };
          })
        );
      }),
    // 更新狀態 / 內部備註 / 關閉原因（狀態轉移寫入稽核）
    updateStatus: staffProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          status: z.enum([
            "new",
            "staff_handling",
            "introduced",
            "matched",
            "closed",
          ]),
          staffNote: z
            .string()
            .trim()
            .max(1000)
            .optional()
            .transform(s => s?.trim() || undefined),
          closeReason: z
            .string()
            .trim()
            .max(200)
            .optional()
            .transform(s => s?.trim() || undefined),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const mr = await getMatchRequestById(input.id);
        if (!mr)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此意向" });
        await updateMatchRequest(input.id, {
          status: input.status,
          staffNote: input.staffNote ?? mr.staffNote,
          // 只有 closed 才保留/更新關閉原因；離開 closed 時清掉，避免留下過時說明
          closeReason:
            input.status === "closed"
              ? (input.closeReason ?? mr.closeReason)
              : null,
        });
        await logAudit(ctx, {
          action: "match.request.update",
          entityType: "match_requests",
          entityId: input.id,
          meta: { status: input.status },
        });
        return { success: true } as const;
      }),
    // 接手：指派給自己（承辦客服一律是操作者，避免把意向指派給非 staff 的 user id）
    assign: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const mr = await getMatchRequestById(input.id);
        if (!mr)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此意向" });
        await updateMatchRequest(input.id, {
          assignedStaffId: ctx.user.id,
          status: mr.status === "new" ? "staff_handling" : mr.status,
        });
        await logAudit(ctx, {
          action: "match.request.assign",
          entityType: "match_requests",
          entityId: input.id,
          meta: { assignedStaffId: ctx.user.id },
        });
        return { success: true } as const;
      }),
  }),

  // ─── 客服：帳號勾稽（自助移工帳號 ↔ 既有名冊，P2 收尾）────────────────────
  // 把自助移工的公開履歷連到既有 workers.id，連結後找移工詳情才會帶出該移工的
  // 平台可信工作紀錄（case_employments）。搜尋名冊屬內部操作，staff 可見真實資料。
  reconcile: router({
    // 所有公開履歷 + 帳號資訊 + 目前連結的名冊移工（含其平台紀錄筆數）
    profiles: staffProcedure.query(async () => {
      const rows = await getAllProfiles();
      return Promise.all(
        rows.map(async p => {
          const [u, linkedWorker] = await Promise.all([
            getUserById(p.userId),
            p.workerId ? getWorkerById(p.workerId) : Promise.resolve(undefined),
          ]);
          const records = p.workerId
            ? await getEmploymentsByWorker(p.workerId)
            : [];
          return {
            id: p.id,
            alias: p.alias,
            nationality: p.nationality,
            jobType: p.jobType,
            moderationStatus: p.moderationStatus,
            publishStatus: p.publishStatus,
            accountEmail: u?.email ?? null,
            accountName: u?.name ?? null,
            workerId: p.workerId,
            linkedWorkerName: linkedWorker
              ? (linkedWorker.nameCn ??
                linkedWorker.nameEn ??
                linkedWorker.name)
              : null,
            recordCount: records.length,
          };
        })
      );
    }),
    // 以姓名/證號搜尋既有名冊（供選擇要連結的移工）
    searchWorkers: staffProcedure
      .input(z.object({ query: z.string().trim().min(1).max(50) }))
      .query(async ({ input }) => searchWorkersForReconcile(input.query)),
    // 連結：把公開履歷連到既有名冊 workers.id
    link: staffProcedure
      .input(
        z.object({
          profileId: z.number().int().positive(),
          workerId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const [profile, worker] = await Promise.all([
          getProfileById(input.profileId),
          getWorkerById(input.workerId),
        ]);
        if (!profile)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此履歷" });
        if (!worker)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此移工" });
        await setProfileWorkerLink(input.profileId, input.workerId);
        await logAudit(ctx, {
          action: "reconcile.link",
          entityType: "worker_public_profiles",
          entityId: input.profileId,
          meta: { workerId: input.workerId },
        });
        return { success: true } as const;
      }),
    // 解除連結
    unlink: staffProcedure
      .input(z.object({ profileId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const profile = await getProfileById(input.profileId);
        if (!profile)
          throw new TRPCError({ code: "NOT_FOUND", message: "找不到此履歷" });
        await setProfileWorkerLink(input.profileId, null);
        await logAudit(ctx, {
          action: "reconcile.unlink",
          entityType: "worker_public_profiles",
          entityId: input.profileId,
        });
        return { success: true } as const;
      }),
  }),
});
export type AppRouter = typeof appRouter;
