/**
 * 對外資料出口——守門與行為測試。
 *
 * 守門測試＝§11 隱私要求的單一測試面：餵一筆「塞滿敏感資料的完整紀錄」，
 * 斷言產出的對外版（含巢狀）不含任何黑名單欄位。行為測試鎖住去識別規則。
 */
import { describe, it, expect } from "vitest";
import {
  toPublicProfile,
  toPublicWorkerCard,
  toPublicEmployerType,
  toPublicJobCard,
  toPublicDemandCard,
  toPublicJobDetail,
  toPublicDemandDetail,
} from "./publicView";
import { PUBLIC_PII_DENYLIST } from "@shared/publicView";
import type {
  Customer,
  JobPosting,
  CaseDemand,
  WorkerPublicProfile,
} from "../drizzle/schema";

// ─── 工具 ───────────────────────────────────────────────────────────────────
/** 遞迴蒐集物件（含巢狀）所有出現過的 key 名。 */
function deepKeys(v: unknown, acc: Set<string> = new Set()): Set<string> {
  if (Array.isArray(v)) {
    for (const item of v) deepKeys(item, acc);
  } else if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v)) {
      acc.add(k);
      deepKeys(val, acc);
    }
  }
  return acc;
}

/** 斷言對外版資料不含任何黑名單欄位（回報實際洩漏了哪些，方便除錯）。 */
function expectNoPii(dto: unknown): void {
  const keys = deepKeys(dto);
  const leaked = PUBLIC_PII_DENYLIST.filter(k => keys.has(k));
  expect(leaked).toEqual([]);
}

// ─── 假資料（皆為「完整、含 PII」的紀錄）────────────────────────────────────────
function fullProfile(
  over: Partial<WorkerPublicProfile> = {}
): WorkerPublicProfile {
  return {
    id: 42,
    userId: 1001, // ← PII 連結：可反查移工帳號
    workerId: 2002, // ← PII 連結：可反查真實移工紀錄
    alias: "小明",
    headline: "資深看護",
    nationality: "印尼",
    yearOfBirth: 1994, // ← 精確生日資訊
    jobType: "caregiver",
    jobTypes: JSON.stringify(["caregiver", "domestic_helper"]),
    preferredCities: JSON.stringify(["台北市", "新北市"]),
    skills: JSON.stringify(["翻身擺位", "備餐"]),
    languages: JSON.stringify(["中文", "印尼文"]),
    availability: "兩週內可上工",
    selfIntro: "機密自我介紹（登入後才給）", // ← 不外露
    photoKey: "s3://photos/real-face.jpg", // ← 真實人臉，不外露
    ratingAvg: 47,
    ratingCount: 8,
    publishStatus: "published",
    moderationStatus: "approved",
    rejectReason: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...over,
  } as WorkerPublicProfile;
}

function fullCustomer(over: Partial<Customer> = {}): Customer {
  return {
    id: 7,
    name: "王大明", // ← PII
    employerType: "company",
    phone: "0912345678", // ← PII
    address: "台北市大安區某路一號", // ← PII
    registeredAddress: "台北市…", // ← PII
    taxId: "12345678", // ← PII
    contactName: "王小姐", // ← PII
    contactPhone: "0987654321", // ← PII
    ...over,
  } as unknown as Customer;
}

function fullPosting(over: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 5,
    employerUserId: 300, // ← PII 連結
    customerId: 7, // ← PII 連結
    jobType: "caregiver",
    city: "台北市",
    district: "大安區",
    employmentType: "full_time",
    headcount: 2,
    publicDescription: "照顧長輩、備餐",
    salaryMin: 30000,
    salaryMax: 36000,
    publishedAt: new Date("2026-02-01"),
    createdAt: new Date("2026-01-15"),
    status: "approved",
    ...over,
  } as unknown as JobPosting;
}

function fullDemand(
  over: Partial<CaseDemand & { publicCity: string | null }> = {}
): CaseDemand & { publicCity: string | null } {
  return {
    id: 9,
    caseId: 88, // ← PII 連結：可反查案件與雇主
    qualType: "domestic_helper",
    neededCount: 3,
    createdAt: new Date("2026-03-01"),
    publicCity: "桃園市",
    ...over,
  } as unknown as CaseDemand & { publicCity: string | null };
}

// ─── 守門：任何對外版皆不得含黑名單欄位 ─────────────────────────────────────────
describe("守門：對外版不得含 PII 欄位（§11）", () => {
  it("toPublicProfile：完整履歷 → 不含 userId/workerId/selfIntro/photoKey/yearOfBirth", () => {
    expectNoPii(toPublicProfile(fullProfile()));
  });
  it("toPublicWorkerCard：完整履歷 → 不含連結與敏感欄位", () => {
    expectNoPii(toPublicWorkerCard(fullProfile()));
  });
  it("toPublicEmployerType：完整雇主 → 只回類型字串，不含名稱/電話/地址/統編", () => {
    expectNoPii(toPublicEmployerType(fullCustomer()));
  });
  it("toPublicJobCard：完整職缺 → 不含 employerUserId/customerId", () => {
    expectNoPii(toPublicJobCard(fullPosting()));
  });
  it("toPublicDemandCard：完整需求單 → 不含 caseId", () => {
    expectNoPii(toPublicDemandCard(fullDemand()));
  });
  it("toPublicJobDetail：完整職缺＋雇主 → 不含任何雇主 PII 或連結", () => {
    expectNoPii(toPublicJobDetail(fullPosting(), fullCustomer()));
  });
  it("toPublicDemandDetail：完整需求單＋雇主 → 不含 caseId 或雇主 PII", () => {
    expectNoPii(toPublicDemandDetail(fullDemand(), fullCustomer()));
  });
});

// ─── 行為：去識別規則 ─────────────────────────────────────────────────────────
describe("toPublicProfile 去識別規則", () => {
  it("年齡只給 5 歲一段的區間、不露精確年", () => {
    const out = toPublicProfile(fullProfile({ yearOfBirth: 1994 }));
    expect(out.ageRange).toMatch(/^\d+–\d+$/);
    expect(deepKeys(out).has("yearOfBirth")).toBe(false);
  });
  it("照片只給布林；有 photoKey → hasPhoto true，且不外露 photoKey", () => {
    const out = toPublicProfile(fullProfile({ photoKey: "s3://x.jpg" }));
    expect(out.hasPhoto).toBe(true);
    expect(deepKeys(out).has("photoKey")).toBe(false);
  });
  it("無 photoKey → hasPhoto false", () => {
    const out = toPublicProfile(fullProfile({ photoKey: null }));
    expect(out.hasPhoto).toBe(false);
  });
  it("評分未達 5 則 → rating 為 null", () => {
    const out = toPublicProfile(fullProfile({ ratingCount: 4, ratingAvg: 45 }));
    expect(out.rating).toBeNull();
  });
  it("評分達門檻 → 給平均分（×1/10 還原）與則數", () => {
    const out = toPublicProfile(fullProfile({ ratingCount: 8, ratingAvg: 47 }));
    expect(out.rating).toEqual({ avg: 4.7, count: 8 });
  });
  it("無代號 → alias 回退為「外籍工作者 #id」", () => {
    const out = toPublicProfile(fullProfile({ alias: null, id: 42 }));
    expect(out.alias).toBe("外籍工作者 #42");
  });
  it("期望職類多選正確解析；主要職類與分桶對齊", () => {
    const out = toPublicProfile(fullProfile());
    expect(out.jobTypes).toEqual(["caregiver", "domestic_helper"]);
    expect(out.jobType).toBe("caregiver");
    expect(out.category).toBe("caregiver");
  });
});

describe("toPublicEmployerType 去識別規則", () => {
  it("公司 → 'company'（純字串）", () => {
    expect(
      toPublicEmployerType(fullCustomer({ employerType: "company" }))
    ).toBe("company");
  });
  it("個人 → 'individual'", () => {
    expect(
      toPublicEmployerType(fullCustomer({ employerType: "individual" }))
    ).toBe("individual");
  });
  it("無雇主 → null", () => {
    expect(toPublicEmployerType(null)).toBeNull();
    expect(toPublicEmployerType(undefined)).toBeNull();
  });
});

describe("toPublicJobCard / toPublicDemandCard", () => {
  it("職缺卡：帶對外欄位、分桶正確、source=posting", () => {
    const out = toPublicJobCard(fullPosting());
    expect(out.source).toBe("posting");
    expect(out.refId).toBe(5);
    expect(out.category).toBe("caregiver");
    expect(out.city).toBe("台北市");
    expect(out.salaryMin).toBe(30000);
  });
  it("需求單卡：source=demand、公開縣市、分桶正確、不含 caseId", () => {
    const out = toPublicDemandCard(fullDemand());
    expect(out.source).toBe("demand");
    expect(out.refId).toBe(9);
    expect(out.category).toBe("domestic_helper");
    expect(out.city).toBe("桃園市");
    expect(deepKeys(out).has("caseId")).toBe(false);
  });
});

describe("toPublicJobDetail / toPublicDemandDetail", () => {
  it("職缺詳情：帶 requirements/expectedStartDate、雇主只露類型字串", () => {
    const out = toPublicJobDetail(
      fullPosting(),
      fullCustomer({ employerType: "company" })
    );
    expect(out.source).toBe("posting");
    expect(out.employerType).toBe("company");
    expect(out).toHaveProperty("requirements");
    expect(out).toHaveProperty("expectedStartDate");
  });
  it("需求單詳情：source=demand、雇主類型、不含 caseId", () => {
    const out = toPublicDemandDetail(
      fullDemand(),
      fullCustomer({ employerType: "individual" })
    );
    expect(out.source).toBe("demand");
    expect(out.employerType).toBe("individual");
    expect(deepKeys(out).has("caseId")).toBe(false);
  });
  it("無雇主 → employerType 為 null", () => {
    const out = toPublicJobDetail(fullPosting(), null);
    expect(out.employerType).toBeNull();
  });
});

// ─── 需求單 P1 對外欄位（職稱/顯示名稱/聘僱型態/薪資/求職者備註閘門）──────────────
describe("需求單 P1 對外欄位（demand card/detail）", () => {
  const richDemand = {
    id: 9,
    qualType: "caregiver" as const,
    neededCount: 2,
    publicCity: "桃園市",
    createdAt: new Date("2026-03-01"),
    label: "住家看護（會煮飯）",
    employerDisplayName: "北市・家庭看護",
    district: "中壢區",
    employmentType: "live_in",
    salaryMin: 28000,
    salaryMax: 32000,
    expectedStartDate: "2026-04-01",
    requirements: "需可煮飯",
    publicDescription: "照顧長輩",
    notesForSeeker: "面談前請先聯繫客服",
  };

  it("需求單卡：帶職稱(label)/顯示名稱代稱/聘僱型態/薪資/區", () => {
    const c = toPublicDemandCard(richDemand);
    expect(c.title).toBe("住家看護（會煮飯）");
    expect(c.employerDisplayName).toBe("北市・家庭看護");
    expect(c.employmentType).toBe("live_in");
    expect(c.salaryMin).toBe(28000);
    expect(c.salaryMax).toBe(32000);
    expect(c.district).toBe("中壢區");
    expect(c.publicDescription).toBe("照顧長輩");
  });

  it("需求單詳情：帶 requirements/expectedStartDate；雇主顯示名稱取自客戶代稱", () => {
    const customer = fullCustomer({
      publicDisplayName: "某科技公司",
    } as never);
    const d = toPublicDemandDetail(richDemand, customer);
    expect(d.requirements).toBe("需可煮飯");
    expect(d.expectedStartDate).toBe("2026-04-01");
    expect(d.employerDisplayName).toBe("某科技公司"); // 客戶代稱優先
  });

  it("求職者備註：預設（未登入）→ null", () => {
    const d = toPublicDemandDetail(richDemand, null);
    expect(d.notesForSeeker).toBeNull();
  });

  it("求職者備註：登入（includeSeekerNotes）→ 帶出", () => {
    const d = toPublicDemandDetail(richDemand, null, {
      includeSeekerNotes: true,
    });
    expect(d.notesForSeeker).toBe("面談前請先聯繫客服");
  });

  it("守門：詳情不含客戶真名（只給去識別代稱）", () => {
    const customer = fullCustomer({
      name: "王大明",
      publicDisplayName: "北市家庭",
    } as never);
    const d = toPublicDemandDetail(richDemand, customer, {
      includeSeekerNotes: true,
    });
    expectNoPii(d); // name 在黑名單
    expect(JSON.stringify(d)).not.toContain("王大明");
  });
});
