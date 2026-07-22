# 功能設計：我的履歷擴增（更多樣、但不複雜）

狀態：**第一個維度已落地（本批次）**：期望工作地區 preferredCities。

## 原則

移工不一定擅長操作 → 新增的資訊維度必須**點選即可、不需打字、不增加心智負擔**，且對「媒合」真正有用、語意中性（避免歧視性欄位）。

## 本批次新增：期望工作地區（preferredCities）

- **為何**：職缺媒合中「地點」是最關鍵維度之一，原本履歷只有職類/技能/語言，缺地點偏好。
- **輸入體驗**：沿用既有「職類多選膠囊」的互動 —— 縣市 chip 點選切換，零打字。
- **資料**：`worker_public_profiles.preferredCities`（JSON 陣列，nullable，additive）。
- **顯示**：找移工詳情頁「關鍵事實」新增一列「期望地區」。
- **多語**：`worker.preferredCities`（表單）、`findWorkers.preferredCities`（詳情）於 zh-TW/en/vi/id 皆補齊。
- **審核**：與其他公開履歷欄位一致 —— 任何編輯都會把 `moderationStatus` 退回 pending（既有規則），故新欄位也走審核，無額外處理。

## 影響檔案

- `drizzle/schema.ts`：worker_public_profiles + `preferredCities text`
- `server/routers.ts`：`workerProfileInput` + `upsertProfile`（JSON.stringify）+ `myProfile`（parse）+ `publicProfileView`（parse 對外）
- `client/src/pages/worker/WorkerProfile.tsx`：縣市多選 chips（reuse TW_CITIES）
- `client/src/pages/employer/FindWorkerDetail.tsx`：詳情 facts 加「期望地區」
- `client/src/i18n/index.ts`：8 個 key（4 語系 × 2）

## 部署備註

`preferredCities` 為 additive nullable 欄位；正式庫需跑 `pnpm db:push`（或既有 migration 流程）補欄位。既有列為 NULL → 顯示為空、不影響。

## 測試

- 整合（real db）`server/resume.integration.test.ts`：upsert→myProfile 回陣列、發布+審核後 findWorkers.get 對外可見、未填回空陣列。
- 前端 `client/src/pages/worker/WorkerProfile.test.tsx`：渲染縣市選項、點選→送出 payload 帶 preferredCities、重複點選取消。

## 後續可加（同樣「點選即可」的簡單維度，待你點頭）

- 期望上工型態（住宿／不住宿／皆可）
- 可上工日（日期選擇器）
- 飲食習慣（如清真／素食；中性、選填）
