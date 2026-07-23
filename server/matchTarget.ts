/**
 * 媒合標的統一解析——唯一能把「一筆媒合意向」解讀成去識別摘要的地方。
 *
 * 四種標的都走這裡：開放諮詢讀意向自身的 inquiry* 欄位；其餘依 targetId 去 DB 撈。
 * 呼叫端（客服佇列、我的意向）只讀回傳的摘要，不再判斷 targetType、不碰 inquiry* 欄位。
 *
 * 依據：docs/feature-match-target.md。
 */
import type { MatchRequest } from "../drizzle/schema";
import type { MatchTargetSummary } from "@shared/matchTarget";
import { jobCategory, type MarketplaceQualType } from "@shared/publicView";
import {
  getJobPostingById,
  getDemandById,
  getCaseById,
  getProfileById,
} from "./db";

/** 一筆媒合意向 → 去識別摘要；真標的查不到回 null，開放諮詢一律有值。 */
export async function resolveTarget(
  row: MatchRequest
): Promise<MatchTargetSummary | null> {
  if (row.targetType === "job_posting") {
    const p = await getJobPostingById(row.targetId);
    if (!p) return null;
    return {
      jobType: p.jobType,
      // 現況 jobType 為 notNull；仍守 null 讓四個分支一致、且欄位日後放寬也不會悄悄變 "other"。
      category: p.jobType
        ? jobCategory(p.jobType as MarketplaceQualType)
        : null,
      city: p.city,
      label: "公開需求單",
    };
  }
  if (row.targetType === "case_demand") {
    const d = await getDemandById(row.targetId);
    if (!d) return null;
    const c = await getCaseById(d.caseId);
    return {
      jobType: d.qualType,
      category: d.qualType
        ? jobCategory(d.qualType as MarketplaceQualType)
        : null,
      city: c?.publicCity ?? null,
      label: "既有需求單",
    };
  }
  if (row.targetType === "worker") {
    const p = await getProfileById(row.targetId);
    if (!p) return null;
    return {
      jobType: p.jobType,
      category: p.jobType
        ? jobCategory(p.jobType as MarketplaceQualType)
        : null,
      // 移工無地點，借「可上工時間」欄位供客服參考。
      city: p.availability ?? null,
      label: p.alias ? `移工履歷（${p.alias}）` : "移工履歷",
    };
  }
  // general_inquiry：無標的，摘要取自意向自身欄位（inquiryCategory 原值含 unsure）。
  return {
    jobType: null,
    category: row.inquiryCategory ?? null,
    city: row.inquiryCity ?? null,
    label: "免費諮詢",
  };
}
