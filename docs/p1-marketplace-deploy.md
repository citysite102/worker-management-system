# P1 公開媒合平台 — 部署與驗收筆記

對應分支：`p1-marketplace-jobs`。本階段交付「需求單張貼 → 審核 → 轉 case + 找工作列表」，並讓既有內部需求單（尚未媒合成功者）在公開站曝光。

## ⚠️ 部署順序（重要）

**先跑 migration，再部署新程式碼。**

新 schema 欄位 `cases.publicCity` 與 `case_demands.publicHidden` 會被既有後台查詢（`getAllCases`、`getDemandsByCaseId` 等）選取。若正式資料庫尚未加上這兩欄就先上新程式碼，**既有的案件/需求頁會查詢失敗**。因為變更全為 additive，先 migrate 一定安全。

```bash
# 1) 對正式資料庫套用 migration（idempotent，可重複執行）
DATABASE_URL=<prod> node scripts/migrate-marketplace-p1.mjs   # P1：job_postings/moderation_events + cases.publicCity/case_demands.publicHidden
DATABASE_URL=<prod> node scripts/migrate-match-requests.mjs   # P3：match_requests（媒合意向）
DATABASE_URL=<prod> node scripts/migrate-worker-profiles.mjs  # P2：worker_public_profiles + worker_experiences

# 2) 再部署新程式碼
```

Migration 內容（`drizzle/0007_marketplace_p1.sql` 為對照 SQL）：

- 新增表 `job_postings`（公開需求單）、`moderation_events`（審核稽核）
- `cases` 加 `publicCity`（公開顯示縣市，去識別）
- `case_demands` 加 `publicHidden`（公開站逐筆隱藏，0/1）

> 測試 / E2E 資料庫走 `drizzle-kit push`（`scripts/setup-test-db.mjs`），會直接依 `drizzle/schema.ts` 建出新表，不需另跑此腳本。

## 權限硬化（WS3）

本階段一併把既有內部 procedure 由 `publicProcedure` 全改為 `staffProcedure`（`auth.*` 維持 public）。**部署前務必確認內部團隊帳號已是 `staff`/`admin`**（`scripts/promote-staff.mjs`），否則團隊會被自己的權限擋在後台外。

## 驗收路徑（可正式登入使用）

1. 訪客到首頁 → 點「我要找工作」→ 被導向 `/login?next=/jobs` → 註冊/登入（移工）→ **回到 `/jobs`**（不再被丟回首頁）。
2. 註冊雇主 → 頁首出現「雇主專區」→ `/employer/post` 張貼需求單（職類/縣市/人數/聘僱型態必填）→ 送審 → 於「我的需求單」看到「審核中」。
3. Staff 用 Email/密碼於 `/login` 登入 → 自動進 `/admin` → 「需求單審核」→ 指派負責人後「通過」→ 自動建立 case + 資格 + 需求。
4. 該職缺出現在 `/jobs`（`source=posting`，單張卡）。
5. 既有內部需求單（`open`/`filling`）預設也出現在 `/jobs`（`source=demand`）；於案件詳情的媒合分頁可設「公開顯示縣市」與逐筆「隱藏」。

## Session cookie（部署環境須知）

Email/密碼登入的 session cookie：正式環境走 HTTPS 時用 `SameSite=None; Secure`（Manus OAuth 跨站導回需要）；**非 HTTPS（本地/純 http 佈署）時自動退回 `SameSite=Lax`**，否則瀏覽器會丟棄 `SameSite=None` 又非 `Secure` 的 cookie，導致「登入成功但下一個請求就沒登入」。因此本地開發真實登入請走 `localhost`（http 會用 Lax，可正常保存 session）。

## E2E（已全綠）

E2E 已改為**真實 staff 登入**（關掉 `DEV_AUTH_BYPASS`，`e2e/helpers/auth.ts` 提供 `loginAs`/`loginAsStaff`），涵蓋既有後台 CRUD、公開站登入導回、需求單審核轉 case → 找工作上架全流程。跑法：需本地 MySQL（`mysql://root:root@localhost:3306`）→ `pnpm e2e`（會自建 `wms_e2e`、灌假資料、建測試帳號）。

## P3 媒合意向（已完成）

「我有興趣」建立 `match_requests`（仲介居中）：求職者/雇主表達興趣 → 客服於 `/admin/match-requests` 佇列接手、推進狀態（新進→處理中→已引介→成交/關閉）；發起者於 `/my-interests` 看自己的意向與狀態。雙方看不到彼此私密聯絡資訊（僅 staff 於後台可見發起者聯絡方式）。表達興趣有可見度守衛（只能對目前公開的職缺送意向）與去重。

## P2 移工側（已完成）

移工於 `/worker/profile` 建立**匿名公開履歷**（代號/國籍/年齡區間/職類/技能/語言/可上工/自介）與**自填工作經歷**，兩者皆需 staff 於 `/admin/moderation`（履歷／自填經歷分頁）審核。雇主（**需至少一張通過的需求單**，§15-1）於 `/find-workers` 瀏覽去識別履歷、進詳情送出媒合意向（match_request，targetType=worker）。真實姓名/證件/電話/精確生日永不對外；年齡只存出生年、顯示 5 歲區間。編輯已通過履歷會退回重審（防繞過審核公開 PII）。平台可信工作紀錄需客服把 `worker_public_profiles.workerId` 勾稽到既有名冊後才顯示。

## 待辦（後續階段）

- 需求單 / 媒合意向的生命週期同步（需求單 `paused/filled/closed`；媒合成交後回寫）。
- 客服勾稽 UI：把自助移工帳號連到既有 `workers`（填 `worker_public_profiles.workerId`）以帶出平台紀錄。
