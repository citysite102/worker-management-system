# 媒合標的統一解析（resolveTarget）

> 狀態：草稿（2026-07-23）｜類型：架構加深（無資料表異動）
> 依據：`docs/marketplace-lead-pipeline.md`（§7.5 開放諮詢入口）、`docs/marketplace-platform-spec.md` §11

## 1. 目標（一句話）

把「一筆媒合意向到底指向什麼」的解讀，從**散在兩個列表、各自手寫「如果是開放諮詢就…」**，改成**單一出口 `resolveTarget(整筆意向) → 統一摘要`**，讓呼叫端不再知道 `targetId=0` 這個暗號、也不再直接讀意向的 `inquiry*` 欄位。

## 2. 為什麼要做（現況痛點）

- 媒合意向有四種標的：職缺（`job_posting`）、既有需求單（`case_demand`）、移工履歷（`worker`）、開放諮詢（`general_inquiry`）。
- 既有的 `resolveMatchTargetSummary(targetType, targetId)` 只認得前三種；開放諮詢是後來「硬接」上去的，用 `targetId=0` 當暗號，摘要另存在意向自己的 `inquiryCategory`／`inquiryCity` 欄位。
- 結果 **`matchRequests.queue`（客服佇列）與 `publicJobs.myInterests`（我的意向）各自手寫一段開放諮詢分支**，各自讀 `r.inquiry*`、各自把資料排成不同形狀。新增第五種標的要改好幾個地方。

## 3. 範圍與非目標

**範圍**：新增 `resolveTarget`；把上述兩個 procedure 改成呼叫它；刪除 `resolveMatchTargetSummary`。

**非目標**：不改資料表、不改「送出意向／諮詢」的建立流程、不改對外回傳格式（兩個列表前端吃的欄位一字不改）。

## 4. 統一摘要的形狀

```ts
type MatchTargetSummary = {
  jobType: string | null; // 具體職類（真標的的 qual）；開放諮詢為 null
  category: JobCategory | "unsure" | null; // 三桶分類：真標的＝jobCategory(jobType)；諮詢＝inquiryCategory 原值
  city: string | null; // 縣市（移工標的借「可上工時間」）
  label: string; // 給客服佇列的標籤
};
```

`resolveTarget(row: MatchRequest): Promise<MatchTargetSummary | null>`——真標的查不到回 `null`（沿用現況），開放諮詢一律有值。

各標的的映射（沿用現況既有規則，只是集中）：

| targetType        | jobType      | category                           | city              | label             |
| ----------------- | ------------ | ---------------------------------- | ----------------- | ----------------- |
| `job_posting`     | `p.jobType`  | `jobCategory(p.jobType)`           | `p.city`          | 公開需求單        |
| `case_demand`     | `d.qualType` | `jobCategory(d.qualType)`          | `case.publicCity` | 既有需求單        |
| `worker`          | `p.jobType`  | `jobCategory(p.jobType)`           | `p.availability`  | 移工履歷（alias） |
| `general_inquiry` | `null`       | `row.inquiryCategory`（含 unsure） | `row.inquiryCity` | 免費諮詢          |

## 5. 呼叫端如何維持「一字不改」

兩個列表改讀統一摘要 `s = resolveTarget(r)`，做純值層映射（不再判斷 targetType、不再讀 `r.inquiry*`、不再知道 `targetId=0`）：

- **`myInterests`**：
  - `jobType: s?.jobType ?? null`
  - `city: s?.city ?? null`
  - `category: s?.category === "unsure" ? null : (s?.category ?? null)`（諮詢的 unsure 濾成 null；真標的為三桶分類）
- **`matchRequests.queue`**：
  - `targetJobType: s?.jobType ?? s?.category ?? null`（真標的＝jobType；諮詢＝inquiryCategory 原值，含 unsure——與現況完全一致）
  - `targetCity: s?.city ?? null`
  - `targetLabel: s?.label ?? null`

以上映射經逐欄推導，與現況輸出逐欄相同（含客服佇列把 inquiryCategory 放在 targetJobType、且保留 unsure 的既有行為）。

## 6. 出口位置

- `shared/matchTarget.ts`：`MatchTargetSummary` 型別（前後端共用；`category` 用到 `@shared/publicView` 的 `JobCategory`）。
- `server/matchTarget.ts`：`resolveTarget(row)`——讀 DB（`getJobPostingById`／`getDemandById`／`getCaseById`／`getProfileById`），分桶用 `@shared/publicView` 的 `jobCategory`。

## 7. 測試計畫（先寫，應為紅燈）

- `server/matchTarget.test.ts`（單元，`vi.mock("./db")`）：四種標的各自的摘要值、真標的查不到回 null、開放諮詢讀自身 `inquiry*` 且不觸發 DB 查詢、`unsure` 原值保留在 category。
- 既有整合測試（`marketplace.integration.test.ts`）對兩個列表的斷言維持綠燈（回傳形狀不變）。

## 8. 部署順序

純程式重整，無資料表異動；一次上線即可。`pnpm verify` 全綠、對外查詢整合測試通過。

## 9. 待拍板

- 客服佇列把 `inquiryCategory`（含 unsure）放在 `targetJobType` 欄是既有的小不一致；本次選擇「一字不改」保留，若日後要清成 `targetCategory` 獨立欄再另議（需同步前端 `MatchRequests.tsx`）。
