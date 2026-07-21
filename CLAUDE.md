# CLAUDE.md — 專案守則

移工／客戶管理系統（內部後台）＋正在往下衍生的**公開媒合平台**。技術棧：tRPC + Drizzle(MySQL) + React 19 + Tailwind v4 + shadcn/radix，部署於 Manus。

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

## ✅ 開發慣例

- 驗證指令：`pnpm verify`（typecheck ×2 + 規約 + 單元 + 前端測試）；提交前 pre-commit hook 會跑格式與規約檢查（含 prettier）。
- 測試：Vitest（`server/*.test.ts` 單元、`*.integration.test.ts` 整合）、`vitest.client.config.ts`（前端元件）、Playwright E2E。新功能請補測試與 `data-testid`。
- 日期以 `YYYY-MM-DD` varchar 存；台北時區用 `Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei"})`。
- 合規引擎（健檢/聘僱許可到期）在 `shared/healthCheck.ts` + `dashboard.compliance`，純函式共用；勿重造到期邏輯。

## 📄 重要文件

- `docs/marketplace-platform-spec.md` — 公開媒合平台規格（v1.0，已定案）
- `docs/p0-foundation-plan.md` — P0 地基技術計畫
- `docs/design-system.md` — 設計系統（Warm Editorial）
