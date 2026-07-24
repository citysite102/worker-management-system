/**
 * 公開媒合平台 P1 的整合測試 —— 打真實 MySQL，不 mock db。
 *
 * 驗證 mock 測不到的事：
 *   - 需求單審核通過後，真的建立了 case + 資格 + 需求並回連 caseId
 *   - publicJobs.list 真的同時撈出「公開需求單」與「既有內部需求單」
 *   - 逐筆隱藏（publicHidden）真的會讓既有需求單從找工作頁消失
 */
import { describe, expect, it } from "vitest";
import {
  createCaller,
  createAnonymousCaller,
  ADMIN_USER,
} from "./__tests__/helpers/caller";
import {
  makeCase,
  makeCustomer,
  makeManager,
  makeWorker,
} from "./__tests__/helpers/fixtures";
import { query } from "./__tests__/helpers/testDb";

// 角色 caller（真 DB）：以固定 id 建立移工/雇主身分的 caller，驗證角色 gating。
const workerCaller = (id: number) =>
  createCaller({
    ...ADMIN_USER,
    id,
    role: "user",
    accountType: "worker",
    workerId: null,
    customerId: null,
  });
const employerCaller = (id: number) =>
  createCaller({
    ...ADMIN_USER,
    id,
    role: "user",
    accountType: "employer",
    workerId: null,
    customerId: null,
  });

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

describe("需求單 P1 職缺欄位：對外顯示與求職者備註閘門", () => {
  it("staff 建帶新欄位需求單 → 公開卡片/詳情帶出；notesForSeeker 僅登入可見", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    // 建立時即設真名與對外顯示名稱（代稱）
    const customerId = await makeCustomer(caller, managerId, {
      name: "王大明家庭",
      publicDisplayName: "北市・家庭看護",
    });
    const caseId = await makeCase(caller, customerId, managerId, {
      name: "P1 案件",
    });
    await caller.cases.setPublicCity({ id: caseId, city: "臺北市" });

    const demand = await caller.caseDemands.create({
      caseId,
      label: "住家看護（會煮飯）",
      qualType: "caregiver",
      neededCount: 1,
      status: "open",
      district: "大安區",
      employmentType: "live_in",
      salaryMin: 28000,
      salaryMax: 32000,
      expectedStartDate: "2026-05-01",
      requirements: "需可煮飯",
      publicDescription: "照顧行動不便長輩",
      notesForSeeker: "面談前請先聯繫客服",
      actualExpectedStartDate: "2026-06-15", // 機密：永不外露
    });

    // 公開卡片（匿名）
    const anon = createCaller(null);
    const jobs = await anon.publicJobs.list();
    const card = jobs.find(j => j.source === "demand" && j.refId === demand.id);
    expect(card).toBeTruthy();
    expect(card!.title).toBe("住家看護（會煮飯）");
    expect(card!.employerDisplayName).toBe("北市・家庭看護");
    expect(card!.employmentType).toBe("live_in");
    expect(card!.salaryMin).toBe(28000);

    // 公開詳情（匿名）：帶對外欄位、但 notesForSeeker 與機密欄位不外露
    const detailAnon = await anon.publicJobs.get({
      source: "demand",
      id: demand.id,
    });
    expect(detailAnon.requirements).toBe("需可煮飯");
    expect(detailAnon.expectedStartDate).toBe("2026-05-01");
    expect(detailAnon.employerDisplayName).toBe("北市・家庭看護");
    expect(detailAnon.notesForSeeker).toBeNull(); // 未登入不給
    // 機密欄位與真名絕不出現
    const anonJson = JSON.stringify(detailAnon);
    expect(anonJson).not.toContain("2026-06-15"); // actualExpectedStartDate
    expect(anonJson).not.toContain("王大明");

    // 公開詳情（登入）：notesForSeeker 帶出
    const detailAuth = await caller.publicJobs.get({
      source: "demand",
      id: demand.id,
    });
    expect(detailAuth.notesForSeeker).toBe("面談前請先聯繫客服");
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

describe("開放諮詢入口（submitInquiry / general_inquiry，§8）", () => {
  it("送出諮詢 → 入列；去重；客服佇列與我的意向皆見；成交後可再送", async () => {
    const caller = createCaller(); // admin：可代發起 + 客服操作

    // 送出開放諮詢（無標的）
    const r1 = await caller.publicJobs.submitInquiry({
      inquiryCategory: "caregiver",
      inquiryCity: "臺北市",
      note: "想請住家看護，想了解流程與費用",
      preferredChannel: "line",
      preferredTime: "evening",
    });
    expect(r1.alreadySent).toBe(false);

    // 一人同時只允許一筆進行中諮詢 → 去重
    const r2 = await caller.publicJobs.submitInquiry({
      inquiryCategory: "other",
    });
    expect(r2.alreadySent).toBe(true);

    // 客服佇列：general_inquiry 摘要取自意向欄位（label=免費諮詢、city/jobType 回填）
    const queue = await caller.matchRequests.queue();
    const q = queue.find(m => m.targetType === "general_inquiry");
    expect(q).toBeTruthy();
    expect(q!.targetLabel).toBe("免費諮詢");
    expect(q!.targetCity).toBe("臺北市");
    expect(q!.targetJobType).toBe("caregiver");
    // 聯絡偏好落地，供業務接手
    expect(q!.preferredChannel).toBe("line");
    expect(q!.preferredTime).toBe("evening");

    // 我的意向：jobType=null、city/category 取自意向欄位
    const mine = await caller.publicJobs.myInterests();
    const inquiry = mine.find(x => x.targetType === "general_inquiry");
    expect(inquiry).toBeTruthy();
    expect(inquiry!.jobType).toBeNull();
    expect(inquiry!.city).toBe("臺北市");
    expect(inquiry!.category).toBe("caregiver");

    // 成交（或關閉）後去重解除，可再送
    await caller.matchRequests.updateStatus({ id: q!.id, status: "matched" });
    const r3 = await caller.publicJobs.submitInquiry({
      inquiryCategory: "unsure",
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
      jobTypes: ["caregiver"],
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

describe("帳號勾稽 → 平台工作紀錄（P2 收尾）", () => {
  it("連結公開履歷↔名冊後，找移工詳情帶出平台驗證紀錄", async () => {
    const caller = createCaller();
    const managerId = await makeManager(caller);
    const workerId = await makeWorker(caller, managerId, { name: "阿明本尊" });
    const customerId = await makeCustomer(caller, managerId);
    const caseId = await makeCase(caller, customerId, managerId, {
      name: "看護案",
    });
    await caller.caseEmployments.create({
      caseId,
      workerId,
      position: "家庭看護",
      contractStart: "2022-01-01",
      status: "active",
    });

    // 自助履歷送審 + 通過
    await caller.worker.upsertProfile({
      alias: "連結測試",
      jobTypes: ["caregiver"],
      submit: true,
    });
    const prof = await caller.worker.myProfile();
    await caller.moderation.approveProfile({ id: prof!.id });

    // 連結前：無平台紀錄
    let detail = await caller.findWorkers.get({ id: prof!.id });
    expect(detail.platformRecords).toHaveLength(0);

    // 客服勾稽 → 連結到名冊
    await caller.reconcile.link({ profileId: prof!.id, workerId });

    // 連結後：帶出平台驗證紀錄（去識別：職務/期間/狀態，無雇主身分）
    detail = await caller.findWorkers.get({ id: prof!.id });
    expect(detail.platformRecords.some(r => r.position === "家庭看護")).toBe(
      true
    );
    // 仍為匿名：不外露 workerId
    expect((detail as Record<string, unknown>).workerId).toBeUndefined();
  });
});

describe("訪客匿名瀏覽 + 未登入的伺服器端遮蔽（真 DB）", () => {
  it("匿名可瀏覽找工作/找移工；未登入 get 隱藏受保護欄位，登入後才下傳", async () => {
    const admin = createCaller();
    const managerId = await makeManager(admin);

    // 一張上架職缺
    const posting = await admin.employer.createPosting({
      jobType: "caregiver",
      city: "臺北市",
      headcount: 1,
      employmentType: "live_in",
      submit: true,
    });
    await admin.moderation.approvePosting({ id: posting.id, managerId });

    // 移工建立含自我介紹＋經歷的履歷並通過
    const worker = workerCaller(1001);
    await worker.worker.upsertProfile({
      alias: "匿名測試",
      nationality: "印尼",
      yearOfBirth: 1995,
      jobTypes: ["caregiver"],
      selfIntro: "祕密自我介紹",
      submit: true,
    });
    const prof = await worker.worker.myProfile();
    const exp = await worker.worker.addExperience({
      employerType: "family_care",
      role: "看護",
      startDate: "2021-01",
    });
    await admin.moderation.approveProfile({ id: prof!.id });
    await admin.moderation.reviewExperience({ id: exp.id, approve: true });

    const anon = createAnonymousCaller();

    // 匿名可瀏覽找工作
    const jobs = await anon.publicJobs.list();
    expect(jobs.some(j => j.source === "posting" && j.city === "臺北市")).toBe(
      true
    );
    // 匿名可瀏覽找移工（摘要）
    const workers = await anon.findWorkers.list();
    expect(workers.some(p => p.alias === "匿名測試")).toBe(true);

    // 未登入 get：gated=true，受保護欄位一律不下傳
    const anonDetail = await anon.findWorkers.get({ id: prof!.id });
    expect(anonDetail.gated).toBe(true);
    expect(anonDetail.selfIntro).toBeNull();
    expect(anonDetail.photoUrl).toBeNull();
    expect(anonDetail.experiences).toEqual([]);
    expect(anonDetail.platformRecords).toEqual([]);

    // 登入 get：gated=false，附上自我介紹與經歷
    const authedDetail = await worker.findWorkers.get({ id: prof!.id });
    expect(authedDetail.gated).toBe(false);
    expect(authedDetail.selfIntro).toBe("祕密自我介紹");
    expect(authedDetail.experiences.some(e => e.role === "看護")).toBe(true);
  });
});

describe("多選期望職類（真 DB）", () => {
  it("upsert 多個 jobTypes → 通過後 view 回陣列，且任一職類都篩得到", async () => {
    const admin = createCaller();
    const worker = workerCaller(1002);
    await worker.worker.upsertProfile({
      alias: "多選王",
      jobTypes: ["caregiver", "manufacturing"],
      submit: true,
    });
    const prof = await worker.worker.myProfile();
    await admin.moderation.approveProfile({ id: prof!.id });

    const anon = createAnonymousCaller();
    const detail = await anon.findWorkers.get({ id: prof!.id });
    expect(detail.jobTypes).toEqual(["caregiver", "manufacturing"]);

    // 兩個職類都能篩到
    const byCare = await anon.findWorkers.list({ jobType: "caregiver" });
    expect(byCare.some(p => p.alias === "多選王")).toBe(true);
    const byManu = await anon.findWorkers.list({ jobType: "manufacturing" });
    expect(byManu.some(p => p.alias === "多選王")).toBe(true);
    // 不相干職類篩不到
    const byAgri = await anon.findWorkers.list({ jobType: "agriculture" });
    expect(byAgri.some(p => p.alias === "多選王")).toBe(false);
  });
});

describe("評分門檻（真 DB）", () => {
  it("ratingCount ≥ 5 才外露平均分與則數，未達則 rating=null", async () => {
    const admin = createCaller();
    const w1 = workerCaller(1003);
    const w2 = workerCaller(1004);
    await w1.worker.upsertProfile({
      alias: "高分",
      jobTypes: ["caregiver"],
      submit: true,
    });
    await w2.worker.upsertProfile({
      alias: "少評",
      jobTypes: ["caregiver"],
      submit: true,
    });
    const p1 = await w1.worker.myProfile();
    const p2 = await w2.worker.myProfile();
    await admin.moderation.approveProfile({ id: p1!.id });
    await admin.moderation.approveProfile({ id: p2!.id });

    // 直接寫入評分聚合（真實評分流程尚未實作）
    await query(
      "UPDATE worker_public_profiles SET ratingAvg = ?, ratingCount = ? WHERE id = ?",
      [47, 8, p1!.id]
    );
    await query(
      "UPDATE worker_public_profiles SET ratingAvg = ?, ratingCount = ? WHERE id = ?",
      [50, 3, p2!.id]
    );

    const list = await createAnonymousCaller().findWorkers.list();
    const hi = list.find(p => p.alias === "高分");
    const lo = list.find(p => p.alias === "少評");
    expect(hi!.rating).toEqual({ avg: 4.7, count: 8 });
    expect(lo!.rating).toBeNull();
  });
});

describe("雇主：需求單退件 → 修改重送（真 DB）", () => {
  it("被退件後可修改重送，狀態回 pending_review 並清除退件理由", async () => {
    const admin = createCaller();
    const managerId = await makeManager(admin);
    const employer = employerCaller(2001);

    const created = await employer.employer.createPosting({
      jobType: "caregiver",
      city: "臺北市",
      headcount: 1,
      employmentType: "live_in",
      submit: true,
    });
    // staff 退件
    await admin.moderation.rejectPosting({
      id: created.id,
      reasonCode: "incomplete",
      note: "缺公開說明",
    });
    let mine = await employer.employer.myPostings();
    expect(mine.find(p => p.id === created.id)?.status).toBe("rejected");

    // 雇主修改後重送
    await employer.employer.updatePosting({
      id: created.id,
      jobType: "caregiver",
      city: "臺北市",
      headcount: 2,
      employmentType: "live_in",
      publicDescription: "已補上完整說明",
      submit: true,
    });
    mine = await employer.employer.myPostings();
    const p = mine.find(x => x.id === created.id);
    expect(p?.status).toBe("pending_review");
    expect(p?.rejectReason).toBeNull();
  });
});

describe("客服：媒合意向指派（真 DB）", () => {
  it("assign 接手：new → staff_handling 並記錄承辦客服", async () => {
    const admin = createCaller();
    const managerId = await makeManager(admin);
    const created = await admin.employer.createPosting({
      jobType: "caregiver",
      city: "臺北市",
      headcount: 1,
      employmentType: "live_in",
      submit: true,
    });
    await admin.moderation.approvePosting({ id: created.id, managerId });

    // 移工表達興趣 → 產生一筆 new 意向
    await workerCaller(1005).publicJobs.expressInterest({
      source: "posting",
      id: created.id,
    });
    const queue = await admin.matchRequests.queue();
    const mr = queue.find(
      m => m.targetType === "job_posting" && m.targetId === created.id
    );
    expect(mr?.status).toBe("new");

    await admin.matchRequests.assign({ id: mr!.id });
    const after = await admin.matchRequests.queue({ status: "staff_handling" });
    const assigned = after.find(m => m.id === mr!.id);
    expect(assigned).toBeTruthy();
    expect(assigned!.assignedStaffId).toBe(ADMIN_USER.id);
  });
});

describe("角色權限 gating（真 DB）", () => {
  it("移工不能張貼需求單；未登入不能自填履歷", async () => {
    await expect(
      workerCaller(1006).employer.createPosting({
        jobType: "caregiver",
        city: "臺北市",
        headcount: 1,
        employmentType: "live_in",
        submit: true,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      createAnonymousCaller().worker.upsertProfile({ alias: "x", submit: true })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("雇主無通過的需求單 → 不能對移工送意向；有通過的需求單 → 可以", async () => {
    const admin = createCaller();
    const managerId = await makeManager(admin);

    // 目標移工履歷（已通過）
    const w = workerCaller(1007);
    await w.worker.upsertProfile({
      alias: "標的移工",
      jobTypes: ["caregiver"],
      submit: true,
    });
    const prof = await w.worker.myProfile();
    await admin.moderation.approveProfile({ id: prof!.id });

    // 沒有通過需求單的雇主 → FORBIDDEN
    const employerNoPosting = employerCaller(2002);
    await expect(
      employerNoPosting.findWorkers.expressInterest({ id: prof!.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // 有通過需求單的雇主 → 可送出
    const employerOk = employerCaller(2003);
    const posting = await employerOk.employer.createPosting({
      jobType: "caregiver",
      city: "臺北市",
      headcount: 1,
      employmentType: "live_in",
      submit: true,
    });
    await admin.moderation.approvePosting({ id: posting.id, managerId });
    const r = await employerOk.findWorkers.expressInterest({ id: prof!.id });
    expect(r.alreadySent).toBe(false);
  });
});

describe("移工：自填經歷 CRUD（真 DB）", () => {
  it("新增 → 編輯 → 刪除", async () => {
    const worker = workerCaller(1009);
    const exp = await worker.worker.addExperience({
      employerType: "family_care",
      role: "看護",
      startDate: "2020-01",
    });
    let list = await worker.worker.myExperiences();
    expect(list.some(e => e.id === exp.id && e.role === "看護")).toBe(true);

    await worker.worker.updateExperience({
      id: exp.id,
      employerType: "institution",
      role: "機構看護",
      startDate: "2021-01",
    });
    list = await worker.worker.myExperiences();
    expect(list.find(e => e.id === exp.id)?.role).toBe("機構看護");

    await worker.worker.deleteExperience({ id: exp.id });
    list = await worker.worker.myExperiences();
    expect(list.some(e => e.id === exp.id)).toBe(false);
  });
});

describe("移工：編輯已通過履歷 → 退回 pending（真 DB）", () => {
  it("已通過履歷一經編輯即退回 pending，於重新通過前不再出現在找移工", async () => {
    const admin = createCaller();
    const worker = workerCaller(1010);
    await worker.worker.upsertProfile({
      alias: "退審測試",
      jobTypes: ["caregiver"],
      selfIntro: "原始內容",
      submit: true,
    });
    const prof = await worker.worker.myProfile();
    await admin.moderation.approveProfile({ id: prof!.id });

    // 通過後找移工可見
    let list = await createAnonymousCaller().findWorkers.list();
    expect(list.some(p => p.alias === "退審測試")).toBe(true);

    // 編輯（存草稿）→ 退回 pending
    await worker.worker.upsertProfile({
      alias: "退審測試",
      jobTypes: ["caregiver"],
      selfIntro: "偷改內容",
      submit: false,
    });
    const after = await worker.worker.myProfile();
    expect(after!.moderationStatus).toBe("pending");

    // 退回 pending 後從找移工消失（重新通過前不曝光）
    list = await createAnonymousCaller().findWorkers.list();
    expect(list.some(p => p.alias === "退審測試")).toBe(false);
  });
});
