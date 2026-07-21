/**
 * 公開媒合平台 P1 的整合測試 —— 打真實 MySQL，不 mock db。
 *
 * 驗證 mock 測不到的事：
 *   - 需求單審核通過後，真的建立了 case + 資格 + 需求並回連 caseId
 *   - publicJobs.list 真的同時撈出「公開需求單」與「既有內部需求單」
 *   - 逐筆隱藏（publicHidden）真的會讓既有需求單從找工作頁消失
 */
import { describe, expect, it } from "vitest";
import { createCaller } from "./__tests__/helpers/caller";
import {
  makeCase,
  makeCustomer,
  makeManager,
} from "./__tests__/helpers/fixtures";
import { query } from "./__tests__/helpers/testDb";

describe("需求單審核 → 自動轉 case", () => {
  it("approve 後建立 case + 資格 + 需求並回連，且上架到找工作", async () => {
    const caller = createCaller(); // admin：可代 employer 張貼、亦可審核

    const managerId = await makeManager(caller);

    const created = await caller.employer.createPosting({
      jobType: "caregiver",
      city: "臺北市",
      headcount: 2,
      employmentType: "live_in",
      publicDescription: "顧奶奶",
      submit: true,
    });
    expect(created.status).toBe("pending_review");

    // 待審佇列可見
    const pending = await caller.moderation.pendingPostings();
    expect(pending.some(p => p.id === created.id)).toBe(true);

    const approved = await caller.moderation.approvePosting({
      id: created.id,
      managerId,
    });
    const caseId = approved.caseId;

    // 案件帶入公開縣市
    const caseRows = await query<{ publicCity: string | null }>(
      "SELECT publicCity FROM `cases` WHERE id = ?",
      [caseId]
    );
    expect(caseRows[0].publicCity).toBe("臺北市");

    // 資格 + 需求各一筆
    const quals = await query<{ qualType: string; quotaTotal: number }>(
      "SELECT qualType, quotaTotal FROM `case_qualifications` WHERE caseId = ?",
      [caseId]
    );
    expect(quals).toHaveLength(1);
    expect(quals[0].qualType).toBe("caregiver");

    const demands = await query<{ neededCount: number; status: string }>(
      "SELECT neededCount, status FROM `case_demands` WHERE caseId = ?",
      [caseId]
    );
    expect(demands).toHaveLength(1);
    expect(demands[0].neededCount).toBe(2);
    expect(demands[0].status).toBe("open");

    // 需求單回連 case 且已上架
    const posting = await query<{ status: string; caseId: number }>(
      "SELECT status, caseId FROM `job_postings` WHERE id = ?",
      [created.id]
    );
    expect(posting[0].status).toBe("approved");
    expect(posting[0].caseId).toBe(caseId);

    // 找工作列表看得到（source=posting）
    const jobs = await caller.publicJobs.list();
    expect(jobs.some(j => j.source === "posting" && j.city === "臺北市")).toBe(
      true
    );
  });
});

describe("既有內部需求單也要在找工作曝光", () => {
  it("open 需求單預設出現；設 publicHidden 後消失", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const customerId = await makeCustomer(caller, managerId);
    const caseId = await makeCase(caller, customerId, managerId, {
      name: "既有案件",
    });
    await caller.cases.setPublicCity({ id: caseId, city: "高雄市" });

    const demand = await caller.caseDemands.create({
      caseId,
      label: "既有需求",
      qualType: "manufacturing",
      neededCount: 1,
      status: "open",
    });

    // 預設曝光
    let jobs = await caller.publicJobs.list();
    expect(jobs.some(j => j.source === "demand" && j.city === "高雄市")).toBe(
      true
    );

    // 逐筆隱藏後消失
    await caller.caseDemands.setPublicHidden({ id: demand.id, hidden: true });
    jobs = await caller.publicJobs.list();
    expect(jobs.some(j => j.source === "demand" && j.city === "高雄市")).toBe(
      false
    );
  });
});
