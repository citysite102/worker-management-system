# 功能設計：評價分數（只限已完成工作）

狀態：**backend 引擎 + 測試（本批次）**；employer 端寫入 UI 待決策 A 確認後再接。

## 核心規則（你的要求）

> 評分只能用在「已經完成的工作」上，不能亂給評價。

## 關鍵設計：評的是「一段已完成的聘僱（employment）」，不是直接評 worker

把評分綁在 `case_employments`（正式聘僱合約）這筆**真實、可稽核**的紀錄上，天然滿足「只限已完成工作」：

- 你只能對一筆**存在且屬於你**的聘僱評分 → 不能亂給。
- 該聘僱必須**已完成** → status ∈ `terminated`/`expired`，或 `contractEnd` 已過 → 才可評。
- 一筆聘僱只能評一次（`ratings.employmentId` UNIQUE）。

顯示端沿用既有：`worker_public_profiles.ratingAvg`(平均×10 存整數)/`ratingCount`，`RATING_MIN_COUNT=5` 才對外顯示，`RatingStars` 元件。

## 資料表（新增）

```
ratings(
  id PK,
  employmentId INT UNIQUE -> case_employments.id,   -- 綁定「已完成聘僱」；一段聘僱一則
  workerId INT -> workers.id,                        -- 冗餘存，便於彙總（= employment.workerId）
  raterUserId INT -> users.id,                       -- 評分者（雇主帳號或代填 staff）
  score TINYINT (1..5),
  comment VARCHAR(500),
  createdAt
  INDEX(workerId)
)
```

## 寫入流程 `ratings.create({ employmentId, score, comment? })`（`protectedProcedure`）

1. 載入 employment；不存在 → `NOT_FOUND`。
2. **完成判定**：status ∈ {terminated, expired}，或（contractEnd 存在且 < 今日/台北）。否則 `FORBIDDEN`「只能評價已完成的工作」。
3. **授權**（單一可調函式 `assertRatingEligible`）：
   - `staff`/`admin`：可代任何聘僱評分（仲介居中模式）。
   - 一般帳號：需為該聘僱案件的雇主 —— `case.customerId === user.customerId`（employer 帳號經 P2 勾稽後才有 customerId）。否則 `FORBIDDEN`。
   - **決策 A（待你確認）**：是否放寬到「線上媒合成交（match_requests.matched）」也可評？預設**不放寬**（那不代表工作已完成，違反你的規則）。
4. **防重複**：`employmentId` 已有評分 → `CONFLICT`「此聘僱已評價過」。
5. 寫入 `ratings`。
6. **重算聚合**：對 `employment.workerId`，若有連結的 `worker_public_profiles`（workerId 相符）→ 重算 `ratingAvg=round(avg*10)`、`ratingCount=n`。無連結履歷則僅存 rating，不顯示（合理）。
7. 稽核 `logAudit(action:"rating.create")`。

## 讀取 `ratings.forWorker({ workerId })`（`publicProcedure`，去識別）

回傳該 worker 的評分清單（score/comment/日期，不含評分者身分），供詳情頁「評價」區塊。仍受 ≥5 聚合門檻控制是否顯示星等；個別評論是否顯示可另設門檻（預設：達門檻才顯示列表）。

## 測試

- 單元（mock db）`server/ratings.test.ts`：完成判定、授權分支（staff/雇主/他人/匿名）、防重複、聚合重算呼叫。
- 整合（real db）`server/ratings.integration.test.ts`：建 manager→customer→worker→case→employment(terminated)，雇主帳號評分→驗 `ratings` 列與 `worker_public_profiles.ratingAvg/Count`；active 聘僱評分被擋；重複評分被擋；非本案雇主被擋。
- 新表 `ratings` 需加入 `server/__tests__/helpers/testDb.ts` 的 `TABLES`。

## 待辦（決策後）

- employer 端「我的已完成聘僱 → 評分」UI（依決策 A 的門檻）。
- 詳情頁「評價」列表區塊（read API 已備）。
