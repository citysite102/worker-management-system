# 對外資料統一出口（publicView）

> 狀態：草稿（2026-07-23）｜類型：架構加深（無資料表異動）
> 依據：`docs/marketplace-platform-spec.md` §11（隱私、資安與法遵）、§15-1（開放匿名瀏覽）

## 1. 目標（一句話）

把「要給外部（未登入訪客、雇主匿名瀏覽）看的資料」的產生方式，從現在**散在各接口、每次手工挑欄位**，改成**只能經由單一出口蓋章產出**；沒蓋章的資料在編譯期就送不出去。

## 2. 為什麼要做（現況痛點）

- 對外資料的遮蔽現在靠約定：`server/routers.ts` 裡有 `publicProfileView`、`publicEmployerType`、`ageRangeFromYear` 等幾個函式，但**列表接口是就地組資料**——例如 `publicJobs.list` 直接吃 `listApprovedJobPostings()` 回來的完整職缺紀錄，再手工挑欄位塞進 `Card`。
- 這代表：任何一個新的對外接口、或有人在既有 `Card` 多加一行 `p.employerNotes`，都沒有東西會擋——一次疏忽就是一次隱私外洩（§11.1 明訂「後端層級過濾，非只前端隱藏」）。
- 遮蔽邏輯散在一支 4,600 行的檔案裡，沒有單一測試面能證明「§11 有被遵守」。

## 3. 範圍與非目標

**範圍（第一刀，完整版）**：

- 移工匿名履歷（`toPublicProfile`）
- 去識別雇主線索（`toPublicEmployer`）
- 職缺卡 / 需求單卡（`toPublicJobCard` / `toPublicDemandCard`）
- 找移工卡（`toPublicWorkerCard`）
- 上述所有對外接口的回傳型別改為「蓋章型別」。

**非目標**：

- 媒合意向標的摘要（`resolveMatchTargetSummary`）——留給後續「resolveTarget」重整，本次不動，但它內部若要產生對外欄位，之後改為呼叫本模組。
- 不改任何資料表、不改權限中介層、不動內部後台（後台顯示完整資料，不經此出口）。

## 4. 名詞

| 名詞               | 白話說明                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 對外版資料         | 要給未登入訪客／匿名瀏覽看的、已去除敏感欄位的資料。                                                                 |
| 蓋章型別           | 一種「蓋了私章」的資料型別（如 `PublicProfile`）。私章只有本模組能蓋，外面拿不到；所有對外接口一律要求回傳蓋章型別。 |
| 出口（publicView） | `server/publicView.ts`——唯一能把內部資料轉成對外版、並蓋章的地方。                                                   |
| 守門測試           | 一條列黑名單的測試，確保任何對外版資料裡都不會出現敏感欄位。                                                         |

## 5. 不能外流欄位（黑名單，依 §11.1）

守門測試以「欄位名稱」為準，任何對外版資料（含巢狀）不得出現下列 key：

- 反查連結：`userId`、`workerId`、`customerId`、`caseId`
- 姓名：`name`、`nameCn`、`nameEn`、`contactName`、`careReceiverName`
- 證件：`residentPermitNo`、`passportNo`、`idNumber`、`taxId`
- 證件影像／照片檔：`photoKey`、`passportKey`、`residentPermitFrontKey`、`residentPermitBackKey`、`passportEntryKey`
- 聯絡與地址：`phone`、`contactPhone`、`address`、`registeredAddress`、`careReceiverAddress`
- 精確日期／健檢：`birthDate`、`careReceiverBirthDate`、`lastMedicalExamDate`、健檢相關欄位
- 自由文字（登入後才給）：`selfIntro`

（清單集中維護於 `server/publicView.ts` 匯出的 `PUBLIC_PII_DENYLIST`，測試與檢查共用同一份。）

## 6. 對外版長相（各實體的白話規則）

沿用現況既有規則，只是集中：

- **移工履歷（`toPublicProfile`）**：只給代號（無代號則「外籍工作者 #id」）、國籍、**年齡區間（5 歲一段，不給精確生日）**、期望職類、技能、語言、期望地區、可上工時間；照片只給「**有沒有**」布林，實際照片登入後才下傳；評分**未達 5 則不露任何數字**。`id` 為履歷 id（供詳情／送意向），非移工 id。
- **雇主線索（`toPublicEmployer`）**：只回「個人／公司」其一，其餘一律不給。
- **職缺卡 / 需求單卡**：職類、地點（公開縣市）、聘僱型態、人數、公開簡述、薪資區間、張貼時間；不含雇主任何身分欄位。
- **找移工卡**：即 `toPublicProfile` 的列表精簡版。

## 7. 蓋章與自動檢查（怎麼讓「忘記遮蔽」擋得住）

1. **型別放共用區**：`shared/publicView.ts` 定義 `PublicProfile`、`PublicEmployer`、`PublicJobCard`、`PublicDemandCard`、`PublicWorkerCard`，皆帶一個以**非匯出私鑰（unique symbol）** 做的私章；前後端共用同一份型別。
2. **唯一建構點**：`server/publicView.ts` 的 `toPublicX(row)` 是唯一能產生蓋章值的地方（讀內部含 PII 資料 → 回蓋章型別）。
3. **接口強制**：對外 tRPC procedure 明寫回傳蓋章型別（`publicJobs.list`→`PublicListingCard[]`、`publicJobs.get`→`PublicListingDetail`、`findWorkers.list`→`PublicWorkerCard[]`、`findWorkers.get`→`PublicProfileDetail`）；直接回原始 row 或未蓋章物件 → 型別不符、編譯失敗。
   - **已知 TS 限制**：`findWorkers.get` 以「去識別底稿 ＋ 登入後受控揭露」拼裝，若有人硬展開原始 row（`{...base, ...rawRow}`），TypeScript 不對展開屬性做多餘欄位檢查、無法在編譯期擋下。此殘留缺口由「規約檢查＋守門黑名單＋審查」縱深防禦；勿在對外接口展開任何未經 `toPublicX` 的 row。
4. **禁繞過**：於既有 `scripts/check-conventions.mjs` 加一條（絕對規則，非 ratchet）——`as PublicProfile`／`as PublicListingCard`／`as PublicListingDetail`／`as Public<…>` 等強制轉型，只允許出現在 `server/publicView.ts`，其餘檔案（測試除外）出現即擋。
5. **守門測試**：對每個 `toPublicX` 餵入「塞滿 PII 的完整 row」，斷言輸出（含巢狀）不含 §5 黑名單任一 key。黑名單涵蓋移工與**雇主/被照顧者**雙方欄位（含 `idNo`、身分證影像 key、`landline`、`referrer` 等 customers 實際欄位），使守門對雇主實體也有效。

## 8. 受影響的檔案與接口

- 新增：`shared/publicView.ts`（型別＋黑名單）、`server/publicView.ts`（`toPublicX`）、`server/publicView.test.ts`（守門＋行為測試）。
- 改動：`server/routers.ts`——`publicJobs.list`／`get`、`findWorkers.list`／`get`、移工履歷詳情等對外 procedure 改為呼叫 `toPublicX` 並回蓋章型別；移除／內縮 `publicProfileView`、`publicEmployerType`、`ageRangeFromYear`（搬入 publicView）。
- 改動：`scripts/check-conventions.mjs`（禁強制轉型規則）＋ `.harness/conventions-baseline.json`（如需 `--update`）。
- 前端：對外元件的 props 型別改吃 `shared/publicView` 型別（行為不變）。

## 9. 測試計畫（先寫，應為紅燈）

- **守門測試**：每個 `toPublicX` 對「滿 PII row」→ 輸出不含黑名單 key。
- **行為測試**：年齡只給區間、照片只給布林、評分未達門檻不露數字、雇主只回個人／公司、職缺卡不含雇主欄位。
- **既有測試**：`marketplace.test.ts` / `marketplace.integration.test.ts` 的對外查詢斷言需維持綠燈（回傳形狀不變，只是型別更嚴）。

## 10. 部署順序

純程式重整，無資料表異動；一次上線即可。上線前 `pnpm verify` 全綠、`pnpm test:integration` 對外查詢通過。

## 11. 待拍板

- 黑名單是否要「白名單反向」再加一層（只允許明列欄位）——本次先用黑名單＋型別強制，白名單列為後續強化。
- `resolveMatchTargetSummary` 併入時機（跟隨候選 3）。
