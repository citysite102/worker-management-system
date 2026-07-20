/**
 * UI 選項清單與資料庫 schema enum 的一致性檢查。
 *
 * 這是本專案最容易悄悄壞掉的地方之一：`client/src/lib/constants.ts` 的選項
 * 是手寫的，`drizzle/schema.ts` 的 enum 是另一份手寫的，兩邊沒有任何機制
 * 綁在一起。一旦漂移就會出現：
 *   - UI 多一個值 → 使用者選得到，但寫入時被資料庫拒絕
 *   - schema 多一個值 → 舊資料顯示成原始英文代碼（getStatusLabel 找不到標籤就回傳原值）
 *
 * 兩種都不會有任何錯誤訊息，只會在使用者眼前壞掉，所以用測試釘住。
 */
import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUS_OPTIONS,
  ASSIGNMENT_STAGE_OPTIONS,
  CASE_MGMT_STATUS_OPTIONS,
  CASE_STATUS_OPTIONS,
  DEMAND_STATUS_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  DOCUMENT_STATUS_OPTIONS,
  EMPLOYER_TYPE_OPTIONS,
  LIFECYCLE_STATUS_OPTIONS,
  OCCUPATION_OPTIONS,
  PRICING_TIER_OPTIONS,
  LABEL_DOMAINS,
  type LabelDomain,
  getStatusColor,
  getStatusLabel,
} from "./constants";
import {
  caseAssignmentWorkers,
  caseDemands,
  caseQualifications,
  cases,
  customers,
  workers,
} from "../../../drizzle/schema";

/** 從 drizzle 的 mysqlEnum 欄位取出允許值。 */
function enumValues(column: unknown): string[] {
  return [...((column as { enumValues: string[] }).enumValues ?? [])];
}

describe("UI 選項與 schema enum 一致", () => {
  const cases_: [string, readonly { value: string }[], unknown][] = [
    ["移工生命週期狀態", LIFECYCLE_STATUS_OPTIONS, workers.lifecycleStatus],
    ["移工文件狀態", DOCUMENT_STATUS_OPTIONS, workers.documentStatus],
    ["移工職業", OCCUPATION_OPTIONS, workers.occupation],
    ["雇主類型", EMPLOYER_TYPE_OPTIONS, customers.employerType],
    ["合約狀態", CONTRACT_STATUS_OPTIONS, customers.contractStatus],
    ["收費級距", PRICING_TIER_OPTIONS, customers.pricingTier],
    // 注意這兩個很容易搞混：
    //   CASE_STATUS_OPTIONS      → 雇主的媒合案件狀態（customers.caseStatus）
    //   CASE_MGMT_STATUS_OPTIONS → 案件本身的狀態（cases.status）
    ["雇主媒合案件狀態", CASE_STATUS_OPTIONS, customers.caseStatus],
    ["案件狀態", CASE_MGMT_STATUS_OPTIONS, cases.status],
    [
      "資格申請狀態",
      APPLICATION_STATUS_OPTIONS,
      caseQualifications.applicationStatus,
    ],
    ["需求狀態", DEMAND_STATUS_OPTIONS, caseDemands.status],
    ["配對成員階段", ASSIGNMENT_STAGE_OPTIONS, caseAssignmentWorkers.stage],
  ];

  for (const [name, options, column] of cases_) {
    it(`${name}：UI 與資料庫的允許值完全相同`, () => {
      const uiValues = options.map(o => o.value).sort();
      const dbValues = enumValues(column).sort();

      expect(uiValues, `${name} 的 UI 選項與 schema enum 不一致`).toEqual(
        dbValues
      );
    });
  }
});

describe("getStatusLabel", () => {
  it("跨領域重複的代碼，指定 domain 後拿到正確標籤", () => {
    // employed 在移工生命週期是「在職中」，在配對階段是「聘僱中」。
    // 不指定 domain 時會拿到 ALL_LABELS 合併後的結果（後合併者勝），
    // 這正是移工列表一度把「在職中」顯示成「聘僱中」的原因。
    expect(getStatusLabel("employed", "lifecycle")).toBe("在職中");
    expect(getStatusLabel("employed", "assignmentStage")).toBe("聘僱中");

    expect(getStatusLabel("rejected", "applicationStatus")).toBe("已退件");
    expect(getStatusLabel("rejected", "assignmentStage")).toBe("婉拒/未錄取");

    expect(getStatusLabel("construction", "occupation")).toBe("建築業");
    expect(getStatusLabel("construction", "qualType")).toBe("營造業");

    expect(getStatusLabel("cancelled", "caseStatus")).toBe("已取消");
    expect(getStatusLabel("cancelled", "caseMgmtStatus")).toBe("取消");
  });

  it("指定 domain 但該領域沒有這個值時，退回合併表", () => {
    expect(getStatusLabel("complete", "lifecycle")).toBe("完備");
  });

  it("所有 UI 選項在自己的領域裡都查得到中文標籤", () => {
    // 查不到標籤時 getStatusLabel 會原封不動回傳代碼，
    // 畫面上就會出現 "idle_in_tw" 這種東西給使用者看。
    for (const [domain, options] of Object.entries(LABEL_DOMAINS)) {
      for (const option of options) {
        expect(
          getStatusLabel(option.value, domain as LabelDomain),
          `${domain}.${option.value} 沒有中文標籤`
        ).toBe(option.label);
      }
    }
  });

  it("未知的值回傳原字串而非爆掉", () => {
    expect(getStatusLabel("這個值不存在")).toBe("這個值不存在");
  });

  it("空字串不會噴錯", () => {
    expect(() => getStatusLabel("")).not.toThrow();
  });
});

describe("getStatusColor", () => {
  it("未知的值退回灰色而非 undefined", () => {
    // 回傳 undefined 會讓 StatusBadge 的 className 少一段，變成沒有樣式的裸標籤
    expect(getStatusColor("這個值不存在")).toBe("gray");
  });

  it("回傳的顏色一定在 StatusBadge 支援的範圍內", () => {
    // blue 曾經漏在 StatusBadge 的 className 判斷之外，導致「進行中」
    // 這類狀態渲染成沒有背景色的裸標籤。
    const known = ["green", "amber", "red", "blue", "gray"];
    const allValues = [
      ...LIFECYCLE_STATUS_OPTIONS,
      ...DOCUMENT_STATUS_OPTIONS,
      ...CASE_STATUS_OPTIONS,
      ...CONTRACT_STATUS_OPTIONS,
    ].map(o => o.value);

    for (const value of allValues) {
      expect(known, `${value} 的顏色不在 StatusBadge 支援範圍`).toContain(
        getStatusColor(value)
      );
    }
  });
});
