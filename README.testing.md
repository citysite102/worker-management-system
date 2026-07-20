# 開發 Harness 指南

這份文件說明本專案的四層把關機制、怎麼跑、以及目前的覆蓋缺口。

## 四層防線

| 層級             | 觸發時機                       | 內容                                        | 耗時   |
| ---------------- | ------------------------------ | ------------------------------------------- | ------ |
| Claude Code hook | 我每次 Edit/Write 之後（背景） | prettier 格式化該檔 + 全專案 `tsc --noEmit` | ~5s    |
| Git pre-commit   | `git commit`                   | 型別 + staged 檔格式 + 專案規約 + 單元測試  | ~10s   |
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

**2. 測試覆蓋** —— 目前 56 支裡有 **44 支沒有任何測試**。baseline 記下這 44 支，
新增沒測試的 procedure 會被擋。

改善之後記得收緊 baseline：

```bash
node scripts/check-conventions.mjs --update
```

## 目前的覆蓋缺口（依優先序）

1. **`server/db.ts`（728 行）零測試** —— 整合測試已經能間接覆蓋一部分，
   但複雜查詢（`getCaseDimensionsBatch`、`getDemandProgressBatch`、KPI 相關）值得直接測。
2. **44 個 procedure 沒有測試** —— 尤其 `caseAssignments.*`（`addWorker`、
   `updateMemberStage`、`workerInvolvements`）與 `dashboard.summary` 這些邏輯最重的。
3. **前端零測試** —— 12 個頁面、所有 component 都沒有測試，也沒裝
   jsdom / testing-library。E2E 目前是唯一的前端防線。
4. **沒有 `data-testid`** —— E2E 只能靠可見文字選元素，改文案就會弄壞測試。
   建議至少在這些地方補上：列表的 row、主要操作按鈕、表單欄位、狀態標籤。
5. **`getCaseChildCounts` 有 N+1** —— `server/db.ts:248` 對每個 assignment
   各查一次 members，可以合併成一次 `GROUP BY` 查詢。

## 已知的粗糙處

- **全 repo 有上百個檔案不符合 prettier 格式**（歷史遺留）。pre-commit 因此只檢查
  本次 staged 的檔案。想一次清乾淨就跑 `pnpm format`，但那會產生一個動到上百個
  檔案的巨大 diff，建議獨立成一個 commit。
- **`create` 系列 procedure 回傳不一致** —— `workers.create` 回傳 `{success, id}`，
  但 `customers.create` 與 `cases.create` 只回傳 `{success}`（`cases` 多一個 `caseNo`），
  沒有新資料的 id，前端無法在建立後直接導向詳情頁。測試 fixtures 因此得建立後再回查一次。
- **E2E 固定用 port 3199** —— `server/_core/index.ts` 在 port 被占用時會自動往上找下一個，
  但 Playwright 只等指定的那一個，所以 port 被占走時會直接逾時而不是自動跟上。
  需要換 port 就設 `E2E_PORT`。（選 3199 是因為 3000/3100 常被其他開發 server 或 Docker 容器占用。）

- **`client/index.html` 的分析標籤佔位符沒被替換** —— 第 16 行的
  `src="%VITE_ANALYTICS_ENDPOINT%/umami"`，在沒設這個環境變數時 Vite 不會替換，
  瀏覽器就去請求字面上的 `/%VITE_ANALYTICS_ENDPOINT%/umami`，造成每個頁面都有
  400 + MIME console error，express 那端還會噴 `URIError: Failed to decode param`。
  功能沒壞，但會汙染 console 也讓真正的錯誤更難發現。E2E 目前把這類訊息列為
  已知雜訊過濾掉（見 `e2e/smoke.spec.ts` 的 `IGNORED_CONSOLE_PATTERNS`）。
  建議改成只在變數存在時才輸出該標籤。
