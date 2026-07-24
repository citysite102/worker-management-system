# 需求單擴充 P1：職缺欄位（規格）

> 狀態：草稿（2026-07-24）｜階段：P1（職缺欄位）｜類型：資料表 additive ＋ 對外顯示
> 依據：`docs/feature-demand-form-review.md`（地基決策）、`docs/marketplace-platform-spec.md` §11、業主 CSV「雇主的需求單」
> 前置定案：載體＝內部 `caseDemands`＋案件；對外一律走 `publicView`；審核用既有 `recordModeration`。

## 1. 目標（一句話）

把業主需求單規格的「職缺欄位」補齊到內部 `caseDemands`（職稱、聘僱型態、薪資、期望/實際上工日、條件要求、公開說明、三種受眾備註），並讓其中對外欄位透過既有 `publicView` 安全曝光——使「內部需求單」的對外卡片能與 marketplace 職缺一樣完整，且不外洩任何內部/機密欄位。

## 2. 範圍與非目標

**P1 範圍**：

- `caseDemands` 新增職缺欄位（見 §4）。
- `customers` 新增「對外顯示名稱（匿名代稱）」。
- 擴充 `publicView` 的需求單卡片/詳情，納入新的對外欄位。
- 後台（`staffProcedure`）建立/編輯這些欄位；補測試與 migration。

**非目標（後續階段）**：

- P2：應徵者個人欄位（身高/體重/學歷/宗教）與工作經驗細節。
- P3：連連看顯示、應徵者專屬備註的受眾閘門、自助移工 opt-in 與勾稽收編。
- P4：付費牆 gating、逐欄 Review 流程、雇主自助張貼（`jobPostings` 路線）。
- 本期**不做**雇主自助建單；建立/編輯一律後台。

## 3. 使用者旅程（P1）

1. **後台**在案件的需求單上填寫職稱、聘僱型態、薪資區間、期望上工日、（僅後台）實際預計上工日、條件要求、公開說明、三種備註；並為該雇主設「對外顯示名稱（匿名代稱）」。
2. 需求單經既有 `listPublicOpenDemands` 浮現到公開站。**一般大眾／登入求職者**看到的是**去識別卡片/詳情**：顯示名稱代稱、職類、縣市、聘僱型態、薪資區間、公開說明、期望上工日等——**永不含**雇主真名、實際預計上工日、機密備註。
3. 登入求職者另可見「求職者用備註」。（「應徵者用備註」的受眾閘門屬 P3。）

## 4. 資料庫欄位（additive；先 migrate 再上碼）

### 4.1 `caseDemands` 新增

| 欄位                      | 型別                                                       | 對外?                | 備註                                                                                |
| ------------------------- | ---------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| （職稱）                  | —                                                          | ✅ 對外              | **定案：沿用既有 `caseDemands.label`（notNull,100）**，不新增欄位。label 即對外職稱 |
| `district`                | varchar(30) null                                           | ✅ 對外              | 工作區（選填）；與 `jobPostings.district` 同型                                      |
| `employmentType`          | mysqlEnum(`live_in`,`live_out`,`institution`,`other`) null | ✅                   | 與 `jobPostings.employmentType` 同 enum                                             |
| `salaryMin`               | int null                                                   | ✅                   | 下限（選填）                                                                        |
| `salaryMax`               | int null                                                   | ✅                   | 上限（選填）                                                                        |
| `expectedStartDate`       | varchar(10) null                                           | ✅                   | 期望上工日 `YYYY-MM-DD`                                                             |
| `actualExpectedStartDate` | varchar(10) null                                           | 🔴 僅後台            | 實際預計上工日；永不外露                                                            |
| `requirements`            | text null                                                  | ✅                   | 條件要求                                                                            |
| `publicDescription`       | text null                                                  | ✅                   | 公開說明                                                                            |
| `notesForSeeker`          | text null                                                  | ✅ 登入求職者/應徵者 | 案件情況備註(求職者用)                                                              |
| `notesForApplicant`       | text null                                                  | 🔴→P3                | 案件情況備註(應徵者用)；**欄位本期建，受眾閘門 P3**                                 |

- 案件情況備註(密) 沿用既有 `caseDemands.notes`（僅後台），不新增。
- 慣例：nullable additive、int 表金額、`YYYY-MM-DD` varchar 日期。

### 4.2 `customers` 新增

| 欄位                | 型別              | 對外? | 備註                                                                            |
| ------------------- | ----------------- | ----- | ------------------------------------------------------------------------------- |
| `publicDisplayName` | varchar(100) null | ✅    | 對外**匿名代稱**（如「北市・家庭看護」）；真名 `name` 永不外露。需送審（見 §6） |

- 雇主情況備註 沿用既有 `customers.notes`，不新增。

> 註：`employmentType`/`salary*` 等與 `jobPostings` 重複是**刻意**的——兩來源（內部需求單／未來雇主自助）都餵同一組 `publicView` 對外卡片，讀取層已統一（`toPublicDemandCard`/`toPublicJobCard`）。

## 5. 對外顯示（`publicView` 擴充）

- 擴充 `toPublicDemandCard` / `toPublicDemandDetail`（`server/publicView.ts`）納入新的對外欄位：職稱（`label`）、`district`、`employmentType`、`salaryMin/Max`、`expectedStartDate`、`requirements`、`publicDescription`、以及雇主的 `publicDisplayName`（去識別代稱）。
  - 注意：`label` 目前為內部需求單標籤，改作對外職稱後需確認既有資料不含 PII（多為「看護 #1」類，安全）；migration 不動 label 值。
- **絕不納入**：`actualExpectedStartDate`、`notes`（密）、`customers.name`/PII——沿用既有蓋章型別與守門測試（黑名單）。
- `notesForSeeker`：僅登入的求職者/應徵者可見（詳情層 gated 欄位，比照 `findWorkers.get` 的受控揭露）。
- `notesForApplicant`：欄位本期建立，**對外閘門延後至 P3**（需連連看關係判定「是否為配對到的應徵者」）。

## 6. 權限與審核（翻譯 CSV 矩陣到既有機制）

| 角色       | 機制                              | P1 行為                 |
| ---------- | --------------------------------- | ----------------------- |
| 一般大眾   | `publicProcedure` ＋ `publicView` | View 去識別卡片/詳情    |
| 登入求職者 | 登入 ＋ `publicView` gated        | 另可見 `notesForSeeker` |
| 後台管理人 | `staffProcedure`                  | 建立/編輯/刪除全部欄位  |
| 雇主       | `employerProcedure`               | P1 唯讀；自助建單屬 P4  |

- **顯示名稱 Review**：**定案：P1 不做二次確認**——由後台設定並信任，即時生效。正式送審流程（moderation `recordModeration`）於引入雇主自助時（P4）啟用。（後台仍須自律確保代稱不含可識別資訊。）

## 7. 狀態機

- 沿用 `caseDemands.status`（`open`/`filling`/…）與 `publicHidden`，不新增狀態。
- 新欄位為屬性欄，不引入獨立狀態機（Review 流程見 §6，延後）。

## 8. 受影響範疇

- `drizzle/schema.ts`：`caseDemands`、`customers` additive 欄位。
- migration：`scripts/`（新增一支；nullable 加欄，安全）。
- `server/db.ts`：`listPublicOpenDemands` 投影補上新的對外欄位；後台建立/編輯需求單的寫入函式擴充。
- `server/publicView.ts` ＋ `shared/publicView.ts`：`PublicListingCard`/`PublicListingDetail` 與 `toPublicDemand*` 擴充。
- `server/routers.ts`：後台需求單 CRUD procedure；`publicJobs.list/get` 對外欄位。
- 前端：後台需求單表單新增欄位；公開卡片/詳情顯示新欄位。

## 9. 測試計畫（先寫，應紅燈）

- **publicView 守門**（延伸既有）：對外需求單卡片/詳情**不含** `actualExpectedStartDate`、`notes`（密）、雇主真名。
- **對外欄位**：卡片/詳情正確帶出 `title`/`employmentType`/`salary`/`publicDescription`/`publicDisplayName`（代稱非真名）。
- **gated**：未登入看不到 `notesForSeeker`；登入求職者看得到。
- **權限**：非 staff 無法建立/編輯需求單欄位。
- **整合**：`marketplace.integration.test.ts` 補真 DB，確認 `listPublicOpenDemands` 帶新欄位且形狀正確。

## 10. 部署順序

1. 先跑 migration 加欄（nullable，安全，可先於程式上線）。
2. 再上程式（db 投影 → publicView → routers → 前端）。
3. `pnpm verify` 全綠、`pnpm test:integration` 對外查詢通過後上線。無資料表破壞性變更。

## 11. 待拍板

- ✅ 職稱：**沿用 `caseDemands.label`**，不新增欄位。
- ✅ 顯示名稱：**P1 不做二次確認**，後台自設即時生效。
- ✅ 縣市「區(選填)」：**本期補**（新增 `caseDemands.district`）。
- 三種備註受眾邊界：沿用設計預設——密＝僅後台、求職者用＝登入求職者/應徵者、應徵者用＝僅配對到的應徵者（後者閘門 P3）。如需調整再議。
