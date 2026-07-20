# 開發 Harness 指南

這份文件說明本專案的四層把關機制、怎麼跑、以及目前的覆蓋缺口。

## 四層防線

| 層級             | 觸發時機                       | 內容                                        | 耗時   |
| ---------------- | ------------------------------ | ------------------------------------------- | ------ |
| Claude Code hook | 我每次 Edit/Write 之後（背景） | prettier 格式化該檔 + 全專案 `tsc --noEmit` | ~5s    |
| Git pre-commit   | `git commit`                   | 型別 ×2 + 格式（不退步）+ 規約 + 單元測試   | ~10s   |
| GitHub Actions   | push / PR                      | 上面全部 + 整合測試 + E2E + 覆蓋率          | 幾分鐘 |
| 手動             | 隨時                           | `pnpm verify` / `pnpm verify:full`          | —      |

## 常用指令

```bash
pnpm verify              # 型別 + 規約 + 單元測試（commit 前跑這個）
pnpm verify:full         # 上面 + 整合測試 + E2E（開 PR 前跑這個）

pnpm test                # 單元測試（mock DB，最快）
pnpm test:watch          # 單元測試 watch 模式
pnpm test:coverage       # 單元測試 + 覆蓋率報告（coverage/index.html）

pnpm test:db:setup       # 建立/重置 wms_test 資料庫（schema 改了才要跑）
pnpm test:integration    # 整合測試（打真實 MySQL）

pnpm e2e                 # E2E（自動起 server + 重建 wms_e2e + 灌假資料）
pnpm e2e:ui              # Playwright UI 模式，適合除錯
pnpm e2e:report          # 看上次的 E2E 報告

pnpm check               # 型別檢查（原始碼）
pnpm check:test          # 型別檢查（測試 + E2E + config）
pnpm lint:conventions    # 專案規約檢查
```

## 三種測試的分工

**單元測試**（`server/*.test.ts`）—— `server/db.ts` 被整包 mock 掉，測的是 procedure
的輸入驗證與商業邏輯。快，但驗不到 SQL 對不對。

**整合測試**（`server/*.integration.test.ts`）—— 打真實 MySQL（`wms_test`），
每個 test 前 TRUNCATE 全表。這是唯一能驗證 SQL、drizzle schema、索引、
FK 約束的一層。需要先 `docker start wms-mysql` 與 `pnpm test:db:setup`。

**E2E**（`e2e/*.spec.ts`）—— 真的開 Chromium 跑使用者流程，用獨立的 `wms_e2e`
資料庫（與 `wms_test` 分開，兩者可同時跑）。

三者用的資料庫互不相干：

| 用途     | 資料庫     | 由誰建立                   |
| -------- | ---------- | -------------------------- |
| 本地開發 | `wms`      | 你自己（見 README.dev.md） |
| 整合測試 | `wms_test` | `pnpm test:db:setup`       |
| E2E      | `wms_e2e`  | `pnpm e2e` 自動重建        |

`scripts/setup-test-db.mjs` 會 DROP 整個資料庫，所以有一道安全閥：名稱不含
`test` 或 `e2e` 就拒絕執行，避免手滑把開發用的 `wms`（或線上資料庫）洗掉。

## 專案規約檢查（棘輪機制）

`scripts/check-conventions.mjs` 針對本專案兩個已知風險做「只能變好、不能變壞」的把關，
現況記錄在 `.harness/conventions-baseline.json`（要 commit）。

**1. 權限** —— 目前 56 個 tRPC procedure **全部是 `publicProcedure`**，
等於整個 API 沒有權限保護；本地靠 `DEV_AUTH_BYPASS` 繞過登入，線上則是全裸。
baseline 記下這 56 支，之後**新增** public procedure 會被擋；把既有的改成
`protectedProcedure` 則會讓清單縮短。

**2. 測試覆蓋** —— 目前 56 支裡有 **43 支沒有任何測試**。baseline 記下這 43 支，
新增沒測試的 procedure 會被擋。清單縮短時檢查器會提示你收緊 baseline。

改善之後記得收緊 baseline：

```bash
node scripts/check-conventions.mjs --update
```

## 目前的覆蓋缺口（依優先序）

1. **`server/db.ts`（728 行）零測試** —— 整合測試已經能間接覆蓋一部分，
   但複雜查詢（`getCaseDimensionsBatch`、`getDemandProgressBatch`、KPI 相關）值得直接測。
2. **43 個 procedure 沒有測試** —— 尤其 `caseAssignments.*`（`addWorker`、
   `updateMemberStage`、`workerInvolvements`）與 `dashboard.summary` 這些邏輯最重的。
3. **前端零測試** —— 12 個頁面、所有 component 都沒有測試，也沒裝
   jsdom / testing-library。E2E 目前是唯一的前端防線。
4. **沒有 `data-testid`** —— E2E 只能靠可見文字選元素，改文案就會弄壞測試。
   建議至少在這些地方補上：列表的 row、主要操作按鈕、表單欄位、狀態標籤。

## 已知的粗糙處

- **全 repo 有上百個檔案不符合 prettier 格式**（歷史遺留）。因此格式檢查採
  「不退步」策略，Claude Code hook 與 pre-commit **共用同一套規則**：

  | 檔案狀況              | 是否強制格式          |
  | --------------------- | --------------------- |
  | 新檔案（HEAD 沒有）   | ✅ 強制               |
  | HEAD 版本已符合格式   | ✅ 強制（不允許退步） |
  | HEAD 版本本來就不符合 | ⬜ 放行               |

  這是必要的：若要求「碰到就得符合格式」，動一個舊檔的 15 行邏輯會產生
  573 行 diff（`server/db.ts` 實際發生過），根本無法審閱。
  想一次清乾淨就跑 `pnpm format`，但那會動到上百個檔案，建議獨立成一個 commit。

  兩層規則若不一致會互相打架 —— 改動其中一邊時記得同步另一邊
  （`scripts/claude-post-edit.sh` 的 `should_format` 與 `.githooks/pre-commit`）。

- **`create` 系列 procedure 回傳不一致** —— `workers.create` 回傳 `{success, id}`，
  但 `customers.create` 與 `cases.create` 只回傳 `{success}`（`cases` 多一個 `caseNo`），
  沒有新資料的 id，前端無法在建立後直接導向詳情頁。測試 fixtures 因此得建立後再回查一次。
- **E2E 固定用 port 3199** —— `server/_core/index.ts` 在 port 被占用時會自動往上找下一個，
  但 Playwright 只等指定的那一個，所以 port 被占走時會直接逾時而不是自動跟上。
  需要換 port 就設 `E2E_PORT`。（選 3199 是因為 3000/3100 常被其他開發 server 或 Docker 容器占用。）

- **E2E 的 console 斷言是嚴格的，沒有雜訊白名單** —— 冒煙測試要求頁面完全沒有
  console error。這是刻意的：一旦開始維護「已知可忽略」清單，真正的錯誤就會
  混進去被忽略。測試失敗時請修源頭，不要加例外。
  （`client/index.html` 的 `%VITE_ANALYTICS_ENDPOINT%` 佔位符原本會讓每頁都噴
  400 + MIME 錯誤，已由 `vite.config.ts` 的 `strip-unconfigured-analytics`
  plugin 在變數未設定時移除該標籤。）
