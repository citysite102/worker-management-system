# CLAUDE.md — 專案守則

移工／客戶管理系統（內部後台）＋正在往下衍生的**公開媒合平台**。技術棧：tRPC + Drizzle(MySQL) + React 19 + Tailwind v4 + shadcn/radix，部署於 Manus。

## 📐 設計系統（前端一律遵循）

**所有前端頁面與元件必須遵循 `docs/design-system.md`（Warm Editorial）。**

- **顏色**：一律使用 Tailwind theme token（`client/src/index.css` 的 `@theme`）或既有 `.status-*` class；**禁止硬編色碼**（不要寫 `#xxxxxx` / `text-emerald-500` 之類的臨時色）。
  - 中性：`background`(paper `#F5F0E6`) / `card`(surface) / `foreground`(ink `#1E1B16`) / `muted-foreground` / `border`(line)。
  - 品牌與點綴：`--color-brand`(moss `#5F6B45`，連結/選中/識別) / `--color-ochre` / `--color-clay` / `--color-taupe`。**主按鈕＝暖黑藥丸**（`primary`）。
  - 到期/狀態色請用 `client/src/lib/expiry.ts` 與 `.status-*`，勿另立。
- **字體**：display 用 `--font-serif`(Fraunces/Noto Serif TC，`.font-display`)；UI/內文用 `--font-sans`(Hanken Grotesk/Noto Sans TC)。勿引入其他字體。
- **圓角/陰影/動態**：用 token（`--radius-*`、暖而極輕的陰影、緩動 `cubic-bezier(.22,1,.36,1)`）。
- **元件優先**：先用既有 shadcn 元件；新增共用元件時，同步更新 `/brand-preview`（活樣式指南）。
- **多語系**：版面須容納越南文/印尼文較長字串與中文較高字身（勿用固定寬度、預留換行、行高從寬）。
- 舊的 teal `#1FA59B` + 吉祥物品牌**已退役**，勿再使用。

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
