# CLAUDE.md — 專案守則

移工／客戶管理系統（內部後台）＋正在往下衍生的**公開媒合平台**。技術棧：tRPC + Drizzle(MySQL) + React 19 + Tailwind v4 + shadcn/radix，部署於 Manus。

## 💬 溝通方式（一律遵循）

**跟使用者討論一律用白話的繁體中文，盡量避免專有名詞。** 需要用到技術名詞時，先用日常講法說清楚在做什麼，再視情況附上原文於括號內；能用比喻或白話解釋就不要堆術語。程式碼、識別字、檔名保留原文。

## 📐 設計系統（前端一律遵循）

**所有前端頁面與元件必須遵循 `docs/design-system.md`（Clean SaaS）。**

風格＝**乾淨的 SaaS 求職平台**：白 / 淺灰為主，**單一品牌深藍**只出現在按鈕、連結、選中、focus 等重點，其餘一律中性。

- **顏色**：一律使用 Tailwind theme token（`client/src/index.css` 的 `@theme`）或既有 `.status-*` class；**禁止硬編色碼**（不要寫 `#xxxxxx` / `text-blue-600` 之類的臨時色）。
  - 中性：`background`(畫布淺灰 `#F7F8FA`) / `card`(白 `#FFFFFF`) / `foreground`(`#17181B`) / `muted-foreground`(`#6B7280`) / `border`(`#E7E9ED`)。
  - 品牌深藍：`--color-primary` = `#1D4ED8`（＝按鈕主色、`--color-brand`）；`--color-accent`(藍淡底 `#EEF2FF`) 作選中/hover；`--color-ring` 藍 focus。**深藍只用在重點，不整片鋪。**
  - **語義色獨立於品牌色**：成功/在職仍用綠（`.status-green`）、警示琥珀、錯誤紅——勿用品牌藍表達「成功」。到期色用 `client/src/lib/expiry.ts` 與 `.status-*`，勿另立。
- **字體**：UI/內文用 `--font-sans`(Hanken Grotesk/Noto Sans TC)；`--font-serif`(Fraunces) 僅保留給公開站行銷大標（`.font-display`），後台勿用襯線。勿引入其他字體。
- **圓角/陰影/動態**：用 token（`--radius-*`：控制項 8px、卡片 10px；淺而克制的陰影）。
- **元件優先**：先用既有 shadcn 元件；新增共用元件時，同步更新 `/brand-preview`（活樣式指南）。
- **多語系**：版面須容納越南文/印尼文較長字串與中文較高字身（勿用固定寬度、預留換行、行高從寬）。
- 已退役、勿再使用：舊 teal `#1FA59B` + 吉祥物、以及一度採用的 Warm Editorial 暖奶油/大地色（moss/ochre/clay）。

## 🔒 後端與權限（重要）

- 目前**多數 tRPC procedure 仍為 `publicProcedure`**（歷史因素）。公開平台上線前需硬化——見 `docs/p0-foundation-plan.md`。
- **新 procedure 一律用 `protectedProcedure` / 角色中介層**，勿新增 public（規約 ratchet 會擋，除非確有必要並 `--update` baseline）。
- 權限分層：`protectedProcedure`（登入）、`adminProcedure`（admin）；P0 將新增 `staffProcedure` / `workerProcedure` / `employerProcedure`。

## 🛠️ 功能開發流程（每個功能一律依序執行）

每開一個新功能，**依下列六階段推進，不可跳步**；每階段結束前先自我把關，關鍵階段跑 Code Review 再往下。

1. **整理規格** — 先在 `docs/` 寫或更新該功能的規格（目標、使用者旅程、狀態機、範圍與非目標、待拍板項）。規格是後續測試與開發的唯一依據；不清楚處先與使用者確認，勿偷偷假設。
2. **確認資料庫欄位與影響範疇** — 對照 `drizzle/schema.ts` 盤點既有表/欄位，決定 additive 擴充或新表（沿用 int PK、`createdAt/updatedAt`、`YYYY-MM-DD` varchar 日期、int 表布林、外鍵索引慣例）；列出受影響的 procedure、前端頁面、migration 與部署順序（**先 migrate 再上程式碼**）。
3. **先寫測試案例** — 依規格與權限矩陣先寫測試（`server/*.test.ts` 單元、`*.integration.test.ts` 真 DB、`vitest.client.config.ts` 前端元件、`e2e/*.spec.ts`）。涵蓋權限 gating、狀態轉移、邊界與去識別/隱私守衛。此時測試應為紅燈。
4. **基於測試與規格開發** — 實作 schema/migration → procedure（角色中介層，勿新增 public）→ 前端（優先取用既有共用元件，禁硬編色碼，補 `data-testid`），逐步讓測試轉綠。
5. **每階段 Code Review** — schema、後端、前端各自完成後，跑 Code Review（`/code-review` 或 review agent）；HIGH/隱私/權限問題當階段修掉再前進，勿累積到最後。
6. **收尾：測試完整且全綠** — 補齊規格對應的測試缺口，`pnpm verify` 全綠、相關 `pnpm e2e` / `pnpm test:integration` 通過；更新規格與記憶的狀態。

## ✅ 開發慣例

- 驗證指令：`pnpm verify`（typecheck ×2 + 規約 + 單元 + 前端測試）；提交前 pre-commit hook 會跑格式與規約檢查（含 prettier）。
- 測試：Vitest（`server/*.test.ts` 單元、`*.integration.test.ts` 整合）、`vitest.client.config.ts`（前端元件）、Playwright E2E。新功能請補測試與 `data-testid`。
- 日期以 `YYYY-MM-DD` varchar 存；台北時區用 `Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei"})`。
- 合規引擎（健檢/聘僱許可到期）在 `shared/healthCheck.ts` + `dashboard.compliance`，純函式共用；勿重造到期邏輯。

## 📄 重要文件

- `docs/marketplace-platform-spec.md` — 公開媒合平台規格（v1.1，已定案）
- `docs/marketplace-lead-pipeline.md` — 業務線索管線增補（§7.5 延伸：聯絡偏好/SLA/結案分類/開放諮詢入口）
- `docs/p0-foundation-plan.md` — P0 地基技術計畫
- `docs/design-system.md` — 設計系統（Clean SaaS）
