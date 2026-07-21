# P0 地基 — 技術實作計畫 v0.1

| 項目     | 內容                                                                                      |
| -------- | ----------------------------------------------------------------------------------------- |
| 文件版本 | v0.1（草稿）                                                                              |
| 撰寫日期 | 2026-07-21                                                                                |
| 上位文件 | `docs/marketplace-platform-spec.md`（規格 v1.0）                                          |
| 範圍     | 公開媒合平台的 **P0 地基**：多角色帳號/認證、權限硬化、公開/後台分流、i18n 框架、稽核日誌 |
| 目標     | 打好「可安全承載公開流量」的底座；本階段不做 P1/P2 的業務頁面                             |

> 本計畫有 5 個**需你拍板的技術決策點**（見 §2），其中 **D1/D2（認證方案）在動工 WS2 前必須先定**。其餘我會以「建議值」推進，你若不反對即照做。

---

## 0. 完成定義（Definition of Done）

P0 完成時應同時滿足：

1. `users` 已擴充為多角色模型並完成 migration；**內部團隊帳號已具 staff/admin 角色**。
2. **所有內部後台 procedure 需 staff/admin 才能存取**；一般登入者/未登入者一律被擋（後端層級，非只前端隱藏）。
3. 認證層支援「已議定的 P0 登入方式」（見 D2）。
4. 前端**公開站 / 後台**路由已分流，並有角色守衛（guard）。
5. i18n 框架就緒，公開殼層可切 zh-TW / vi / id / en。
6. `audit_logs` 已記錄認證、角色變更、（未來）揭露/審核等敏感事件。
7. 測試：角色權限測試綠燈；規約 ratchet 更新（public procedure 數量**下降**）。

---

## 1. 現況盤點（P0 起點）

| 面向 | 現況                                                                                                                         | 缺口                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 認證 | Manus SDK 單一 OAuth；`context.ts` 由 `sdk.authenticateRequest` 取 user；本地有 `DEV_AUTH_BYPASS`                            | 缺多 provider（LINE/FB/Google）、Email/密碼、手機/WhatsApp OTP    |
| 角色 | `users.role` 僅 `user`/`admin`；只有 `ENV.ownerOpenId` 自動 admin，其餘皆 `user`                                             | 缺 `staff`、缺 `accountType(worker/employer)`、缺帳號↔資料表連結 |
| 授權 | **57 支 procedure 全為 `publicProcedure`**（規約 baseline 記錄在案）；`protectedProcedure`/`adminProcedure` 已定義但幾乎未用 | 內部後台等於無授權——**阻斷級風險**                                |
| 路由 | wouter 單一 app，全部包在 `DashboardLayout`；`App.tsx` 一個 `Switch`                                                         | 缺公開/後台分流與 guard                                           |
| i18n | 無，介面字串全硬編 zh-TW                                                                                                     | 全新建框架                                                        |
| 稽核 | 無 audit log                                                                                                                 | 全新建                                                            |

---

## 2. 需拍板的技術決策點

| #      | 決策                | 選項                                                                                                                                 | 建議                                                                                  | 何時需定       |
| ------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | -------------- |
| **D1** | 認證方案            | (a) 沿用/擴充 Manus SDK（若支援 LINE/FB/Google/WhatsApp）；(b) 專用認證服務（Clerk / Supabase Auth）；(c) 自建（各社群 OAuth + OTP） | **先花半天驗證 Manus SDK 支援度**；不足則採 (b) 專用服務，避免自建 OTP/社群的長尾成本 | **WS2 動工前** |
| **D2** | P0 認證範圍         | (i) P0 就上齊社群+WhatsApp OTP；(ii) **P0 先 Email/密碼 + 既有 OAuth（給 staff）**，社群/WhatsApp OTP 排到 P1 頭段                   | **(ii) 分階段**：P0 專注硬化與地基，登入方式先求可用，社群/WhatsApp 隨 P1 移工註冊上  | **WS2 動工前** |
| **D3** | WhatsApp OTP 供應商 | Meta Cloud API 直連 / Twilio / MessageBird                                                                                           | 待 D1 定案後選；需注意 WhatsApp Business 帳號審核與費用                               | P1 前          |
| **D4** | i18n 函式庫         | react-i18next（成熟、namespace 懶載）/ 輕量自建 / react-intl                                                                         | **react-i18next**                                                                     | WS5 動工前     |
| **D5** | 內部後台路由        | 維持 `/` / 改前綴 `/admin`                                                                                                           | **改 `/admin` 前綴**，公開站佔 `/`，界線清楚                                          | WS4 動工前     |

> D2 的建議直接影響 §0 第 3 點的「已議定 P0 登入方式」——若你同意 (ii)，P0 的 DoD 只要求 Email/密碼 +（給 staff 的）既有 OAuth。

---

## 3. 工作分解（Workstreams）

### WS1 — 資料模型與 migration（地基，最先）

**內容**

- `users` 擴充：
  - `role enum('user','staff','admin')`（**新增 staff**；MySQL 加 enum 值為相容變更）
  - `accountType enum('worker','employer','staff') NULL`（null＝既有/owner）
  - `workerId int NULL`、`customerId int NULL`（帳號↔資料表連結，P1/P2 才寫入）
  - `phone varchar(20) NULL`、`phoneVerified boolean default false`
  - `preferredLang enum('zh-TW','vi','id','en') NULL`
- 新增 `audit_logs`（見 WS6）。
- **不含** job_postings / worker_public_profiles 等業務表（那是 P1/P2）。

**Drizzle 遷移**：改 `drizzle/schema.ts` → `pnpm db:push`（generate + migrate）。注意 `migrate` 腳本已改讀環境變數（Manus 相容）。

**資料回填（關鍵）**：

- owner 仍 admin。
- **內部團隊成員帳號手動升為 `staff`**（一次性腳本或由 admin 於後台指派）。**此步驟必須在 WS3 之前完成**，否則硬化會把團隊自己鎖在門外。

---

### WS2 — 認證層（依 D1/D2）

**內容**

- 依 D1 決定：擴充 Manus SDK 或導入專用服務。
- 依 D2 範圍：P0 至少提供 Email/密碼（雇主友善）+ 既有 OAuth（staff）；社群/WhatsApp OTP 介面先預留、P1 接上。
- `context.ts` 調整：認證後除了帶出 `user`，一併帶出 `role`/`accountType` 供中介層判斷。
- 保留 `DEV_AUTH_BYPASS`（本地開發）。

**抽象化**：把「provider → 取得 openId/email/phone」封裝成 `AuthProvider` 介面，之後加 provider 不動核心。

---

### WS3 — 權限硬化（**阻斷級，P0 核心**）

**內容**

1. `trpc.ts` 新增角色中介層（沿用現有 `protectedProcedure`/`adminProcedure` 的寫法）：
   ```ts
   export const staffProcedure = protectedProcedure.use(
     requireRole(["staff", "admin"])
   );
   export const employerProcedure = protectedProcedure.use(
     requireAccountType("employer")
   );
   export const workerProcedure = protectedProcedure.use(
     requireAccountType("worker")
   );
   ```
2. **既有 57 支內部 procedure 由 `publicProcedure` → `staffProcedure`**（managers / workers / customers / cases / caseSub* / dashboard.*）。這是機械但大範圍的替換。
3. **資源層授權**框架：提供 `assertOwnership(user, resource)` 輔助，供 P1/P2 的「雇主只能看自己的需求單、移工只能編自己的履歷」使用（P0 先建工具，實際套用隨業務 procedure）。
4. 規約 ratchet：轉為 staff 後 public 數量下降 → `node scripts/check-conventions.mjs --update` 重設 baseline（方向正確：更少 public）。

**測試**：新增角色權限測試——未登入 / user / worker / employer 呼叫內部 procedure 應被擋；staff/admin 可通過。

**風險/順序**：務必在 WS1 回填 staff 之後才部署，並在 staging 驗證後台仍可用。

---

### WS4 — 公開 / 後台分流（依 D5）

**後端**

- 將 `appRouter` 重構為命名空間：
  ```
  appRouter = router({
    staff:    staffRouter,     // 既有內部（managers/workers/customers/cases/dashboard…）
    public:   publicRouter,    // 公開唯讀（首頁資料等，P1+）
    worker:   workerRouter,    // 移工自助（P2）
    employer: employerRouter,  // 雇主自助（P1）
    auth:     authRouter,      // 登入/註冊/OTP
  })
  ```
- P0 主要完成：既有內容歸入 `staff` 命名空間 + 套 staffProcedure；其餘 router 先建空殼。

**前端**

- 路由分區：`/admin/*`（內部，維持 zh-TW）、`/`（公開站，P1+）。
- 新增 `RequireRole` guard 元件：未達 staff/admin 進 `/admin` → 導向登入。
- P0：把現有頁面移到 `/admin` 前綴、包上 guard；公開殼層先放 placeholder + 語言切換。
- 建置：先維持單一 Vite app + 路由層 code-split；若公開流量/體積需要再拆獨立 bundle。

---

### WS5 — i18n 框架（依 D4）

**內容**

- 導入 **react-i18next**：catalogs `zh-TW`（base）/ `vi` / `id` / `en`，namespace 懶載。
- 語言切換元件 + 記憶使用者偏好（`users.preferredLang` / localStorage）。
- **範圍界定**：**內部後台維持 zh-TW-only**（staff 為台灣人）；i18n 只套在公開殼層與 P1/P2 的移工/雇主介面。
- 使用者內容機器翻譯（需求單/履歷）是 **P1+** 的事，P0 只建介面字串框架。

---

### WS6 — 稽核日誌

**內容**

- `audit_logs`：`actorUserId, action, entityType, entityId, meta(json), ip, createdAt`。
- tRPC 中介層 `withAudit`：對敏感 mutation（登入、角色變更、未來的審核/揭露）自動寫入。
- P0 先接：認證事件、角色指派。P1/P2 再接審核與揭露。

---

## 4. 相依順序與里程碑

```
WS1(schema+migration) ──▶ 回填 staff 角色 ──▶ WS3(硬化) ──▶ 部署驗證後台仍可用
       │                                          ▲
       ├──▶ WS6(audit 表) ────────────────────────┘
       ├──▶ WS4(分流骨架，前端可先行)
       ├──▶ WS5(i18n 框架，可平行)
       └──▶ WS2(認證層，D1/D2 定案後可平行)
```

| 里程碑  | 完成標誌                                                             |
| ------- | -------------------------------------------------------------------- |
| M1 地基 | WS1 migration 上線、團隊帳號已 staff/admin、audit_logs 就緒          |
| M2 硬化 | WS3 完成，內部 procedure 全數 staff-only，權限測試綠燈、ratchet 更新 |
| M3 分流 | WS4 前後端命名空間 + `/admin` guard 就位                             |
| M4 認證 | WS2 依 D2 範圍可登入/註冊；provider 抽象化                           |
| M5 i18n | WS5 公開殼層可切 4 語                                                |

---

## 5. 不破壞現有後台的遷移策略（關鍵）

現行內部後台**已在 Manus 上服務**，硬化不能讓團隊斷線。守則：

1. **先給角色、再上鎖**：WS1 回填 staff/admin **務必**先於 WS3 部署。
2. **staging 先行**：WS3 先在非正式環境驗證「staff 能用、user 被擋」。
3. **DEV_AUTH_BYPASS 保留**：本地開發不受影響。
4. **可回滾**：WS3 是「procedure 中介層」層級變更，必要時可快速還原成 protected/public；migration 為相容性 additive，低風險。
5. **無破壞性 schema 變更**：全部為新增欄位/新增 enum 值/新增表，不刪不改既有欄位。

---

## 6. 測試策略

- 沿用現有 Vitest（單元/元件）、整合、Playwright E2E、規約 ratchet、pre-commit hook。
- **新增**：
  - 角色權限矩陣測試（每種 procedure × 每種角色的可/不可）。
  - 認證流程整合測試（登入取得對應 role/accountType）。
  - guard 元件測試（未授權導向登入）。
- ratchet：硬化後 `--update` 讓 public 基線下降；新 procedure 一律走角色中介層。

---

## 7. 風險登記

| 風險                            | 等級 | 對策                                                |
| ------------------------------- | ---- | --------------------------------------------------- |
| WS3 先於角色回填 → 團隊被鎖     | 高   | §5 嚴格順序；staging 驗證                           |
| 認證方案（D1）選型延誤卡住 WS2  | 中   | D1 先做半天 spike；WS1/3/4/5 不等它可先行           |
| WhatsApp Business 帳號審核/費用 | 中   | D2 建議把 WhatsApp OTP 排到 P1，不卡 P0             |
| 大範圍 public→staff 替換出錯    | 中   | 機械替換 + 權限測試全覆蓋 + ratchet 把關            |
| 就業服務法合規（規格 §15-15）   | 高   | 屬 P1 業務欄位；P0 不觸及，但需你方法務於 P1 前確認 |

---

## 8. 你需要拍板的事（彙整）

- **D1**：認證方案（先 spike Manus SDK？不足採 Clerk/Supabase？）——**WS2 前必答**
- **D2**：P0 登入範圍（建議：先 Email/密碼 + 既有 OAuth，社群/WhatsApp 排 P1）——**WS2 前必答**
- **D3**：WhatsApp OTP 供應商（P1 前）
- **D4**：i18n 用 react-i18next？（建議 yes）
- **D5**：內部後台改 `/admin` 前綴？（建議 yes）

> 你回覆 D1/D2（或說「照建議走」）我就能把本計畫轉 v1.0 並開始 WS1。
