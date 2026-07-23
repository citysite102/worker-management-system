# 夜間開發批次總覽（2026-07-23）

分支：`feat/marketplace-overnight`。每個完成且測試通過的功能各自 commit。
本檔＝早上第一份該讀的文件：各功能現況、**需你決策的項目**、以及**第三方登入的申請清單（時效性最高，建議一早先辦）**。

各功能細部設計文件：

- `docs/feature-oauth-social-login.md`（第三方登入）
- `docs/feature-ratings.md`（評價分數）
- `docs/feature-match-review.md`（意向審核）
- `docs/feature-resume-plus.md`（履歷擴增）
- `docs/feature-ux-readability.md`（全站 UX／閱讀性）

---

## 各功能現況（研究後的事實，非猜測）

| #   | 功能           | 現況                                                                                                | 本批次做什麼                                                                      |
| --- | -------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | 第三方登入     | 既有只有 Manus 平台 SSO + Email/密碼。無 Google/LINE/FB 直連                                        | 建立 provider-agnostic OAuth scaffold（Google/LINE/FB），**待你提供憑證**才會啟用 |
| 2   | 全站 UX/閱讀性 | 設計系統已統一 console 頁（本批次前先做）                                                           | 針對閱讀性/互動性做具體收斂                                                       |
| 3   | 我的履歷擴增   | 欄位：alias/headline/nationality/年齡/jobTypes/skills/languages/availability/selfIntro + 自填經歷   | 增加「簡單但多樣」的呈現欄位（不增加操作複雜度）                                  |
| 4   | 後台意向審核   | **其實已存在**：`/match-requests`（後台選單「媒合意向」），staff 可過濾/改狀態/接手                 | 補齊為正式審核流：關閉原因、內部備註 UI、`moderation_events` 稽核軌跡、骨架載入   |
| 5   | 評價分數       | **僅有顯示端**：`RatingStars`、≥5 則才顯示、聚合欄位（存平均×10）。無資料表、無寫入、無「完成」判定 | 從零建：`ratings` 表 + 受限寫入（只限已完成工作）+ 重算聚合                       |

---

## ⚠️ 需要你決策的項目（我先採用最保守可辯護的預設，並標記可調整處）

### A. 評價「已完成工作」的判定錨點（最重要）

你的規則：「評分只能用在已經完成的工作上，不能亂給評價」。但資料模型中**沒有單一『此媒合已完成』旗標**。最接近的真實憑證是內部合約表 `case_employments`（狀態 `terminated` 已終止／`expired` 合約到期）連結 `workerId ↔ caseId`。

我採用的預設判定（可在單一函式 `assertRatingEligible` 調整）：

- **雇主可評移工**：需存在一筆該雇主（customer）↔ 該移工（worker）的 `case_employments`，且狀態為 `terminated`/`expired` 或 `contractEnd` 已過。
- 一筆完成合約只能評一次（`ratings` 對 `(raterUserId, workerId, employmentId)` 唯一）。
- **公開媒合層的問題**：自助 marketplace 的 `match_requests` 目前不會產生 `case_employments`（兩層只透過 `reconcile` 手動勾稽）。因此「純線上媒合、未走內部建案」的成交，暫時無法評分。
- **需你確認**：(1) 是否也允許「移工評雇主」？(2) 是否接受「僅限有內部合約者可評」這個較嚴格的門檻，或要放寬到 `match_requests.status='matched'`？（放寬會讓「未實際完成工作」也能評，與你的規則衝突，故我預設不放寬。）

### B. 第三方登入要上哪幾家？ ✅ 已定並實作

**Google + Facebook（OAuth 一鍵）+ WhatsApp（手機 OTP）**，皆已實作、env-gated。LINE 已移除。
WhatsApp 是手機號 OTP（非 OAuth），走 Meta Cloud API。**你要準備**：WhatsApp Business + Cloud API（Token + Phone Number ID）+ 送審 OTP 範本（見申請清單）。

### C. Email 帳號合併策略 ✅ 已實作（依你指示開啟合併）

社群登入帶回的 **可信 email** 與既有帳號相同 → **自動合併**到既有帳號（`oauth_identities` 表 + `resolveOAuthUser`）。
安全門檻：只有可信 email 才合併（Google `email_verified`、FB 已確認 email），未驗證 email 不合併、另建帳號——防帳號接管。

---

## 🔑 第三方登入：早上申請清單（時效性最高，先辦）

> LINE 的 email 權限審核、Facebook 的 App Review 都要「數天」，**越早送件越好**。上線時 email 設計為可選，未過審也能先登入。

### Google（Google Cloud Console，約 15 分鐘）

- [ ] 建立/選專案 → 設定 **OAuth consent screen**，發布到 Production
- [ ] 建立 **OAuth client ID（Web application）**
- [ ] Authorized redirect URIs 加入（正式 + 測試 + `http://localhost:3199/auth/oauth/google/callback`）
- [ ] 給我 **Client ID** + **Client secret**

### Facebook（Meta for Developers）

- [ ] 建 App（Consumer）→ 加 **Facebook Login** 產品
- [ ] 設 **Valid OAuth Redirect URIs** + App Domains + 隱私權政策 URL
- [ ] 送 **App Review** 要 `email`，並切到 Live
- [ ] 給我 **App ID** + **App Secret**

### WhatsApp（Meta WhatsApp Cloud API，**若要做 OTP 登入**）

- [ ] 開通 **WhatsApp Business** + **Cloud API**（Meta for Developers → WhatsApp）
- [ ] 取得 **Access Token** + **Phone Number ID**
- [ ] **送審 authentication（OTP）訊息範本** ← 長前置
- [ ] 跟我說要做 → 我補 OTP 流程（手機輸入 + 收碼 + 驗證）

我會把 Google/FB 憑證貼進 `.env`（變數名見 `docs/feature-oauth-social-login.md` §6）。

---

## 測試策略（每功能都做）

- 單元（mock DB）：`server/<feature>.test.ts` → `pnpm test`
- Real DB 整合：`server/<feature>.integration.test.ts` → `docker start wms-mysql` → `pnpm test:db:setup` → `pnpm test:integration`
  - 新資料表要加入 `server/__tests__/helpers/testDb.ts` 的 `TABLES` 陣列（truncate 才會涵蓋）
- 前端元件：`client/src/**/<name>.test.tsx` → `pnpm test:client`
- E2E（如適用）：`e2e/<name>.spec.ts` → `pnpm e2e`

## 進度勾稽（本批次完成）

- [x] 設計系統統一（console 頁）+ Home hero + 詳情頁
- [x] #5 評價分數（ratings 表 + 受限寫入 + 聚合重算；11 單元 + 6 real DB）— 待決策 A
- [x] #4 意向審核 enhancement（備註/關閉原因 UI + 骨架 + 顯示；4 前端測試）
- [x] #3 履歷擴增（期望工作地區，全語系；3 real DB + 3 前端）
- [x] #1 第三方登入 scaffold（Google/LINE/FB，env-gated；9 測試）— 待憑證 + live 冒煙
- [x] #2 全站 UX/閱讀性（設計統一 + `EmptyState` 空狀態統一；持續，見 feature-ux-readability.md）

**早上請先看**：本檔上方「需要你決策的項目」(A/B/C) 與「第三方登入申請清單」。
所有變更在分支 `feat/marketplace-overnight`，逐 feature commit。合併前建議先在本機跑一次
`pnpm verify`（＋ `docker start wms-mysql && pnpm test:db:setup && pnpm test:integration`）。
正式庫需 `pnpm db:push` 補新表／欄位：`ratings`、`oauth_identities`、`phone_otps`，以及 `worker_public_profiles.preferredCities`。
