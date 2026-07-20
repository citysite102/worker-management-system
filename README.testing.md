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

pnpm test:client         # 前端測試（jsdom + Testing Library）
pnpm test:client:watch   # 前端測試 watch 模式

pnpm e2e                 # E2E（自動起 server + 重建 wms_e2e + 灌假資料）
pnpm e2e:ui              # Playwright UI 模式，適合除錯
pnpm e2e:report          # 看上次的 E2E 報告

node scripts/check-orphans.mjs          # 掃描孤兒資料（子表指向已刪除的父列）
node scripts/check-orphans.mjs --delete # 順便清掉

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

**前端測試**（`client/src/**/*.test.tsx`）—— jsdom + Testing Library，設定在
`vitest.client.config.ts`。與 server 測試分開是必要的：server 跑 node 環境、
前端要 jsdom，混在同一個 config 會互相打架。

**E2E**（`e2e/*.spec.ts`）—— 真的開 Chromium 跑使用者流程，用獨立的 `wms_e2e`
資料庫（與 `wms_test` 分開，兩者可同時跑）。E2E 一律用 `data-testid` 選元素，
不綁可見文字 —— 文案是產品會反覆調整的東西，綁文案的測試會在改字時假性失敗，
那種失敗多了大家就會開始無視 E2E。

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

**2. 測試覆蓋** —— 56 支裡目前只剩 **3 支沒有測試**（`auth.me`、
`customers.uploadFile`、`workers.uploadFile`，都依賴 OAuth/S3 等外部服務）。
baseline 記下這 3 支，新增沒測試的 procedure 會被擋。
清單縮短時檢查器會提示你收緊 baseline。

改善之後記得收緊 baseline：

```bash
node scripts/check-conventions.mjs --update
```

## 元件測試怎麼寫

`client/src/__tests__/trpcMock.ts` 是 tRPC 的測試替身。專案裡沒有元件直接用
@tanstack/react-query，全部走 `@/lib/trpc`，所以整包換掉 trpc 物件就夠，
不需要 QueryClientProvider 或 MSW。

```ts
vi.mock("@/lib/trpc", async () => {
  const { trpcMock } = await import("../__tests__/trpcMock");
  return { trpc: trpcMock };
});

beforeEach(() => {
  resetTrpcMock();
  setQueryData("managers.list", [{ id: 1, name: "陳專員" }]);
});
```

範本看 `client/src/components/WorkerModal.test.tsx`。幾個會浪費時間的坑：

- **Radix 會渲染兩份內容**（一份給螢幕閱讀器）。`getByText` 抓標題或 tooltip
  會 "Found multiple elements"，改用 `getByRole("heading", { name })` /
  `getByRole("tooltip")`。
- **先確認元件用 `mutate` 還是 `mutateAsync`**。斷言錯了看到的現象是「表單
  好像沒送出」，很容易往 react-hook-form 驗證的方向找錯半天。
- **要測「後端回錯誤時元件怎麼反應」用 `setMutationError(path, error)`**。
  有些元件把錯誤訊息當控制流程用（`CustomerModal` 靠
  `err.message.startsWith("DUPLICATE_NAME:")` 決定要不要跳同名確認視窗），
  沒有這個就完全測不到。`mutate` 只走 `onError`；`mutateAsync` 會 reject。
- **餵給 `setQueryData` 的資料不要每次 render 重新產生**。Modal 的 useEffect
  依賴陣列裡有查詢結果，參考一直變會造成無限迴圈、測試直接卡死。
  trpcMock 內部已經做了參考快取，但別在測試裡繞過它。

## 目前的覆蓋缺口（依優先序）

1. **`CustomerModal` 編輯模式的 managerId 可能送出 NaN** ——
   `missingFields` 在編輯模式一律是空陣列，所以送出鈕永遠可按；`onSubmit`
   的 `if (!data.managerId)` 擋不住 `String(null)` 產生的 `"null"`，
   接著 `parseInt("null")` = NaN 就送進後端。需要先決定「既有資料的
   managerId 可不可以是 null」才好補測試。
2. **`CaseModal` 的 `ADMIN_TAB_FIELDS` 是空陣列** —— Tab 2 的錯誤徽章永遠
   不會亮。目前 Tab 2 全部選填所以無害，但 schema 裡 `employmentPeriodMonths`
   有 `.min(1).max(36)`，輸入 40 會產生 zod 錯誤卻不計入任何 Tab 徽章，
   使用者只會看到「按了沒反應」。是定時炸彈，不是現在就壞。
3. **`CustomerModal` 的 `SelectField` 定義在元件函式體內** —— 每次 render 都是
   新的元件型別，React 會整個 unmount/remount 三個下拉。目前功能沒壞，
   但這是效能與焦點行為的隱患。
4. **兩個 Modal 的 DialogContent 缺 `Description`／`aria-describedby`** ——
   無障礙問題，跑測試時 Radix 也會對每個 test 噴警告。
5. **`CaseModal` 的表單欄位幾乎沒有 `data-testid`**，`FormField` 的 `htmlFor`
   一次都沒傳，所以 label 沒跟控制項綁定。測試只能靠 placeholder 文字認欄位，
   改個文案就會壞。補 `htmlFor` 同時也修掉無障礙問題。
6. **`CustomerQualifications`（589 行）與 `ImportWorkerModal`（523 行）零測試** ——
   兩者都有不少狀態機式的邏輯。ImportWorkerModal 還牽涉 CSV 解析與檔案上傳。
7. **E2E 沒有真正的 CRUD 流程** —— 目前只驗到「送出鈕 disabled ↔ enabled 的
   轉換」與「刪除確認框有跳出來」，不按下去。因為 E2E 共用單一 `wms_e2e` 且
   測試間不重置，任何寫入都會讓後續測試的列數斷言變得不確定。
   要補真正的 CRUD，得先讓 E2E 有 per-test 或 per-file 的資料重置機制。
8. **3 個 procedure 沒有測試** —— `auth.me`、`customers.uploadFile`、
   `workers.uploadFile`，都需要先把 OAuth / S3 的外部依賴抽出來才好測。

已完成的部分：`data-testid` 已覆蓋 Cases / Workers / Customers / Dashboard
四個頁面與對應 Modal；hooks（`useComposition`、`useFormEnterNav`、`usePersistFn`）
與 `StatusBadge`、`constants`、`exportToCsv` 都有測試。

## UI 標籤與 schema 的一致性

`client/src/lib/constants.ts` 的選項清單與 `drizzle/schema.ts` 的 enum 是兩份
各自手寫的東西，沒有任何機制綁在一起。漂移的話會出現：UI 多一個值 → 使用者
選得到但寫入被資料庫拒絕；schema 多一個值 → 舊資料顯示成英文代碼。
兩種都不會有錯誤訊息，只會在使用者眼前壞掉，所以由
`client/src/lib/constants.test.ts` 逐一比對釘住。

另外要注意**跨領域重複的代碼**：`employed` 在移工生命週期是「在職中」、在配對
階段是「聘僱中」；`rejected` 在申請狀態是「已退件」、在配對階段是「婉拒/未錄取」。
`ALL_LABELS` 是把所有清單合併起來的，後合併者會覆蓋前者。顯示的欄位領域明確時，
請用 `getStatusLabel(value, domain)` 或 `<StatusBadge domain="..." />` 指定領域。

## 資料完整性

schema 原本**完全沒有 FK 約束**，資料完整性全靠應用層自律，結果就是刪除雇主
會留下孤兒案件（仍出現在案件列表上、雇主欄空白）。現在兩層都有守：

- **應用層**：`customers.delete` 底下有案件就擋（案件牽涉勞動部許可函與聘僱
  契約，誤刪難以回復，所以是擋下而非連坐刪除）；`managers.delete` 名下還有
  移工／雇主／案件也擋。兩者都給可讀的中文訊息。
- **資料庫層**：14 個 FK 約束。應用層的檢查可能被繞過（直接下 SQL、新增的
  procedure 忘了檢查），所以資料庫層也要有一道。整合測試裡有直接下 SQL
  驗證 FK 真的會擋，避免變成只寫在 schema 卻沒套用到資料庫的裝飾。

沒有獨立意義的子表（被照顧者、客戶資格）則是連動刪除，不擋。

**注意**：`drizzle-kit generate` 目前會進入互動模式詢問欄位是新增還是改名 ——
migration 快照與現行 schema 已經不同步。FK 是用 `drizzle-kit push`（比對實際
資料庫而非快照）套用的。動 schema 前請先跑 `node scripts/check-orphans.mjs`。

## 已知但尚未處理的產品問題

寫 E2E 時讀到、但需要你決定或牽涉較大改動的，先記在這裡：

1. **`Customers.tsx` 的定價篩選是死路徑** —— Select 已被註解掉（「待定價資料
   建立後再開啟」），但 `pricingFilter` 仍計入 `hasActiveFilter`，篩選提示列
   也還留著一個可移除的定價 chip。使用者永遠無法讓它變成非 `all`。
   要嘛把定價篩選放回來，要嘛連同殘留的狀態一起清掉。
2. **`WorkerModal` 的「負責人」必填形同虛設** —— 新增模式下 `managerId` 會
   自動帶入 `managers[0]`，所以 `missingFields` 的負責人那項只有在「系統完全
   沒有負責人」時才出現。`onSubmit` 裡還有一份重複的 `if (!managerId)` 檢查。
3. **搜尋實作不一致** —— Cases 是 server-side + 300ms debounce；Workers 與
   Customers 是把整份清單抓下來在前端 `useMemo` 過濾，沒有 debounce 也沒有
   分頁。資料量長大後 Workers/Customers 會先出問題。
4. **`CustomerModal` 的同名警告 Dialog 疊在主 Dialog 之上**（兩個 Dialog 同時
   open）。沒有實測過，值得手動確認 focus trap 與 Esc 行為是否正常。
5. **`Cases.tsx` 的 CSV 匯出有一欄永遠是空的** —— `c.managementStatus` 這個
   欄位在 schema、routers、型別裡都不存在，只在 CSV 匯出被引用。因為那段用了
   `cases.map((c: any) => ...)`，型別檢查抓不到。

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

- **`create` 系列 procedure 現在一律回傳 `{ success, id }`** —— 原本只有
  `workers.create` 回傳 id，其餘都只回 `{ success }`，前端無法在建立後直接
  導向新資料的詳情頁。現在 `server/db.ts` 的 11 個 `create*` 都經由共用的
  `insertedId()` 回傳主鍵。既有欄位沒有變動，所以對現有呼叫端完全相容。
- **本地不要同時跑兩份 E2E** —— `playwright.config.ts` 的
  `reuseExistingServer: !process.env.CI` 讓本地第二份 E2E 直接接上第一份起的
  server；第一份跑完收掉 server 之後，第二份就會整片 `ERR_CONNECTION_REFUSED`。
  CI 上不受影響（該選項為 false，每次都起自己的 server）。

- **E2E 固定用 port 3199** —— `server/_core/index.ts` 在 port 被占用時會自動往上找下一個，
  但 Playwright 只等指定的那一個，所以 port 被占走時會直接逾時而不是自動跟上。
  需要換 port 就設 `E2E_PORT`。（選 3199 是因為 3000/3100 常被其他開發 server 或 Docker 容器占用。）

- **E2E 的 console 斷言是嚴格的，沒有雜訊白名單** —— 冒煙測試要求頁面完全沒有
  console error。這是刻意的：一旦開始維護「已知可忽略」清單，真正的錯誤就會
  混進去被忽略。測試失敗時請修源頭，不要加例外。
  （`client/index.html` 的 `%VITE_ANALYTICS_ENDPOINT%` 佔位符原本會讓每頁都噴
  400 + MIME 錯誤，已由 `vite.config.ts` 的 `strip-unconfigured-analytics`
  plugin 在變數未設定時移除該標籤。）
