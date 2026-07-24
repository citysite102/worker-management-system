// ─── 審核領域模組（深縫）──────────────────────────────────────────────────────
// 把「需求單審核通過 → 自動建立案件」這齣戲從路由抽出來：搶佔 → 建 customer stub /
// case / 資格 / 需求 → 回填，中途失敗補償回滾。這個不變量（回滾）以前只能透過
// tRPC caller 摸到；抽成模組後可直接單元測試（見 server/moderation.test.ts）。
// 比照 server/{matchTarget,publicView,mutationGuards}.ts 的 server-level 縫慣例。
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";
import {
  getJobPostingById,
  claimJobPostingForApproval,
  getUserById,
  createCustomer,
  createCase,
  createQualification,
  createDemand,
  updateJobPosting,
} from "./db";
import { recordModeration } from "./mutationGuards";

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

export interface ApprovePostingInput {
  id: number;
  managerId: number;
  caseName?: string;
}

/**
 * 審核通過一張公開需求單，並自動建立對應案件。
 * ctx 只用於 recordModeration（雙寫稽核），故只收 user/req 兩個欄位。
 */
export async function approvePostingToCase(
  ctx: Pick<TrpcContext, "user" | "req">,
  input: ApprovePostingInput
): Promise<{ success: true; caseId: number }> {
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
    await recordModeration(
      ctx,
      {
        entityType: "job_posting",
        entityId: input.id,
        action: "approve",
      },
      {
        action: "moderation.posting.approve",
        entityType: "job_postings",
        meta: { caseId, customerId },
      }
    );
    return { success: true, caseId } as const;
  } catch (err) {
    // 建 case 中途失敗 → 還原成待審，讓此單可重新審核（best-effort）。
    await updateJobPosting(input.id, { status: "pending_review" }).catch(
      () => {}
    );
    throw err;
  }
}
