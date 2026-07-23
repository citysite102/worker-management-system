/**
 * 媒合標的統一解析——單元測試（mock ./db）。
 *
 * 鎖住四種標的的摘要值、真標的查不到回 null、開放諮詢讀自身欄位且不觸發 DB，
 * 以及 unsure 原值保留在 category。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MatchRequest } from "../drizzle/schema";

vi.mock("./db", () => ({
  getJobPostingById: vi.fn(),
  getDemandById: vi.fn(),
  getCaseById: vi.fn(),
  getProfileById: vi.fn(),
}));

import { resolveTarget } from "./matchTarget";
import * as db from "./db";

/** 建一筆媒合意向假資料（預設職缺標的）。 */
function mr(over: Partial<MatchRequest> = {}): MatchRequest {
  return {
    id: 1,
    initiatorUserId: 10,
    targetType: "job_posting",
    targetId: 5,
    status: "new",
    note: null,
    inquiryCategory: null,
    inquiryCity: null,
    createdAt: new Date("2026-03-01"),
    updatedAt: new Date("2026-03-01"),
    ...over,
  } as MatchRequest;
}

beforeEach(() => vi.clearAllMocks());

describe("resolveTarget", () => {
  it("job_posting → 職類/縣市/公開需求單", async () => {
    vi.mocked(db.getJobPostingById).mockResolvedValue({
      id: 5,
      jobType: "caregiver",
      city: "台北市",
    } as never);
    const s = await resolveTarget(
      mr({ targetType: "job_posting", targetId: 5 })
    );
    expect(s).toEqual({
      jobType: "caregiver",
      category: "caregiver",
      city: "台北市",
      label: "公開需求單",
    });
  });

  it("job_posting 查不到 → null", async () => {
    vi.mocked(db.getJobPostingById).mockResolvedValue(undefined as never);
    expect(await resolveTarget(mr({ targetType: "job_posting" }))).toBeNull();
  });

  it("case_demand → qualType + case.publicCity + 既有需求單", async () => {
    vi.mocked(db.getDemandById).mockResolvedValue({
      id: 9,
      caseId: 88,
      qualType: "domestic_helper",
    } as never);
    vi.mocked(db.getCaseById).mockResolvedValue({
      id: 88,
      publicCity: "桃園市",
    } as never);
    const s = await resolveTarget(
      mr({ targetType: "case_demand", targetId: 9 })
    );
    expect(s).toEqual({
      jobType: "domestic_helper",
      category: "domestic_helper",
      city: "桃園市",
      label: "既有需求單",
    });
  });

  it("worker → jobType + availability(當 city) + 移工履歷（alias）", async () => {
    vi.mocked(db.getProfileById).mockResolvedValue({
      id: 42,
      jobType: "manufacturing",
      availability: "兩週內",
      alias: "小明",
    } as never);
    const s = await resolveTarget(mr({ targetType: "worker", targetId: 42 }));
    expect(s).toEqual({
      jobType: "manufacturing",
      category: "other", // manufacturing 不屬看護/房務 → other
      city: "兩週內",
      label: "移工履歷（小明）",
    });
  });

  it("worker 無 alias → label 回退為「移工履歷」，availability 空則 city=null", async () => {
    vi.mocked(db.getProfileById).mockResolvedValue({
      id: 42,
      jobType: "caregiver",
      availability: null,
      alias: null,
    } as never);
    const s = await resolveTarget(mr({ targetType: "worker", targetId: 42 }));
    expect(s?.label).toBe("移工履歷");
    expect(s?.city).toBeNull();
  });

  it("general_inquiry → 讀自身 inquiry* 欄位，不觸發任何 DB 查詢", async () => {
    const s = await resolveTarget(
      mr({
        targetType: "general_inquiry",
        targetId: 0,
        inquiryCategory: "caregiver",
        inquiryCity: "新竹市",
      })
    );
    expect(s).toEqual({
      jobType: null,
      category: "caregiver",
      city: "新竹市",
      label: "免費諮詢",
    });
    expect(db.getJobPostingById).not.toHaveBeenCalled();
    expect(db.getDemandById).not.toHaveBeenCalled();
    expect(db.getProfileById).not.toHaveBeenCalled();
  });

  it("general_inquiry 的 unsure 原值保留在 category", async () => {
    const s = await resolveTarget(
      mr({
        targetType: "general_inquiry",
        targetId: 0,
        inquiryCategory: "unsure",
        inquiryCity: null,
      })
    );
    expect(s).toEqual({
      jobType: null,
      category: "unsure",
      city: null,
      label: "免費諮詢",
    });
  });
});
