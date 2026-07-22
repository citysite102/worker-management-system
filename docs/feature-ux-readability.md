# 功能設計：全站 User 閱讀性 / UX 互動性

狀態：**持續進行**。本批次已落地數項；其餘列為建議，逐步收斂。

## 本批次已做

1. **設計系統統一（console 頁）**：`PageHeader`/`SurfaceCard`/`SkeletonList`/`Field` 對齊；版寬成系統（browse 6xl／detail 5xl／console 3xl／form 2xl）。取代散落的手刻卡片與 `…` 載入。
2. **首頁 hero 改版**：深藏青滿版 + 照片就緒（缺圖自動收合單欄）——脫離「AI 漸層感」。
3. **找移工詳情**：左欄白 surface + 分隔線切段，右卡微浮成主從——解決「與背景融合」。
4. **空狀態統一 `EmptyState`**：Jobs／FindWorkers／MyInterests／Postings／MatchRequests 的空清單，從「一行灰字」改為 icon + 訊息（可帶下一步 action），讀起來更明確、更一致。
5. **意向審核**：載入骨架、備註/關閉原因 UI。

## 建議（未做，供排序）

- **空狀態帶行動**：例如「目前沒有需求單 → 立即張貼」按鈕（`EmptyState` 已支援 `action`，接上即可）。
- **表單即時驗證與錯誤提示**：目前多為送出後 toast；可加欄位級 `field-error`（index.css 已有 class）。
- **多語長字串壓力測試**：越南文/印尼文較長，檢查按鈕/卡片不被撐破（設計系統已要求，但需逐頁掃）。
- **可及性**：list/卡片的鍵盤操作與 `aria-*`；圖片 alt；對比度（語義色已達 AA，品牌藍鈕文字白對比足夠）。
- **行動版**：hero 雙欄在窄螢幕已收合；其餘頁面於 <375px 的觸控目標與換行再驗。
- **載入一致性**：仍有少數頁用文字載入，逐步換 `SkeletonList`/`SkeletonGrid`/`SkeletonCard`。
- **閱讀節奏**：長文字區塊（自我介紹/需求描述）行高與段距可再放寬。

## 原則

- 一律走 `docs/design-system.md` token；品牌藍只在重點（鈕/連結/選中/focus），不整片鋪。
- 元件優先：新共用件同步進 `client/src/components/marketplace/ui.tsx`（本批次新增 `SkeletonList`/`EmptyState`/`Field`/`inputCls`）。
- 多語系容納較長字串與較高中文字身。

## 測試

- `client/src/components/marketplace/EmptyState.test.tsx`（訊息/testid 透傳/action）。
- 各頁既有空狀態 testid 維持不變，回歸由既有頁面測試覆蓋。
