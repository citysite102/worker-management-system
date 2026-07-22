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

describe("媒合意向（match_requests，P3）", () => {
  it("表達興趣建立意向；重複不重複建立；客服可推進狀態", async () => {
    const caller = createCaller(); // admin：可代發起 + 客服操作
    const managerId = await makeManager(caller);
    const created = await caller.employer.createPosting({
      jobType: "caregiver",
      city: "臺北市",
      headcount: 1,
      employmentType: "live_in",
      submit: true,
    });
    await caller.moderation.approvePosting({ id: created.id, managerId });

    // 表達興趣 → 建立
    const r1 = await caller.publicJobs.expressInterest({
      source: "posting",
      id: created.id,
    });
    expect(r1.alreadySent).toBe(false);

    // 重複 → 去重
    const r2 = await caller.publicJobs.expressInterest({
      source: "posting",
      id: created.id,
    });
    expect(r2.alreadySent).toBe(true);

    // 客服佇列看得到，且「我的意向」也看得到
    const queue = await caller.matchRequests.queue();
    const mine = queue.find(
      m => m.targetType === "job_posting" && m.targetId === created.id
    );
    expect(mine).toBeTruthy();
    const myInterests = await caller.publicJobs.myInterests();
    expect(
      myInterests.some(
        x => x.targetId === created.id && x.jobType === "caregiver"
      )
    ).toBe(true);

    // 推進到成交後，去重解除（可再次表達）
    await caller.matchRequests.updateStatus({
      id: mine!.id,
      status: "matched",
    });
    const r3 = await caller.publicJobs.expressInterest({
      source: "posting",
      id: created.id,
    });
    expect(r3.alreadySent).toBe(false);
  });
});

describe("移工履歷 + 找移工（P2）", () => {
  it("履歷送審→通過→找移工看得到；經歷審核；雇主送意向", async () => {
    const caller = createCaller(); // admin：可代移工自填、亦可審核、亦可雇主瀏覽

    // 1) 自填履歷並送審
    await caller.worker.upsertProfile({
      alias: "阿明",
      nationality: "印尼",
      yearOfBirth: 1996,
      jobType: "caregiver",
      skills: ["翻身", "備餐"],
      languages: ["中文", "印尼文"],
      availability: "即刻",
      selfIntro: "細心可靠",
      submit: true,
    });
    const profile = await caller.worker.myProfile();
    expect(profile?.moderationStatus).toBe("pending");
    expect(profile?.skills).toEqual(["翻身", "備餐"]);

    // 2) 自填一段經歷（待審）
    const exp = await caller.worker.addExperience({
      employerType: "family_care",
      role: "家庭看護",
      startDate: "2022-01",
    });

    // 3) 未通過前，找移工看不到
    let list = await caller.findWorkers.list();
    expect(list.some(p => p.alias === "阿明")).toBe(false);

    // 4) 客服審核佇列可見並通過
    const pendingProfiles = await caller.moderation.pendingProfiles();
    const mine = pendingProfiles.find(p => p.alias === "阿明");
    expect(mine).toBeTruthy();
    await caller.moderation.approveProfile({ id: mine!.id });
    await caller.moderation.reviewExperience({ id: exp.id, approve: true });

    // 5) 通過後找移工看得到，且為匿名視圖（不含 userId/workerId）
    list = await caller.findWorkers.list();
    const card = list.find(p => p.alias === "阿明") as Record<string, unknown>;
    expect(card).toBeTruthy();
    expect(card.userId).toBeUndefined();
    expect(card.workerId).toBeUndefined();
    expect(card.ageRange).toBeTruthy();

    // 6) 詳情含已通過的自填經歷
    const detail = await caller.findWorkers.get({ id: card.id as number });
    expect(detail.experiences.some(e => e.role === "家庭看護")).toBe(true);

    // 7) 雇主送出媒合意向（targetType=worker）
    const r = await caller.findWorkers.expressInterest({
      id: card.id as number,
    });
    expect(r.alreadySent).toBe(false);
    const queue = await caller.matchRequests.queue();
    expect(
      queue.some(m => m.targetType === "worker" && m.targetId === card.id)
    ).toBe(true);
  });
});
