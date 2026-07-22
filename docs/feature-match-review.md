# 功能設計：後台意向審核（enhancement）

狀態：**已存在 → 補齊為可用的審核流**（本批次）。

## 現況（研究後事實，非「後台沒有」）

- 後端 `matchRequests` router（`staffProcedure`）：`queue`（過濾）、`updateStatus`（狀態＋`staffNote`＋`closeReason`，且離開 closed 會清 closeReason）、`assign`（接手）。
- 前端 `client/src/pages/MatchRequests.tsx`，路由 `/match-requests`，後台選單「媒合意向」。staff 可過濾、改狀態、接手。

**你覺得「沒有」的原因＝功能不完整**：後端已支援「內部備註 / 關閉原因」，但**前端沒有任何欄位可以填**；只有一個 status `<select>`。且載入態是純文字 `載入中…`。

## 本批次的補齊（純前端，無 schema/後端變更）

1. **內部備註 + 關閉原因 UI**：每張卡新增可展開的「備註／關閉原因」編輯區（沿用既有 `updateStatus` 的 `staffNote`/`closeReason`）。把狀態改成「已關閉」時，提示填關閉原因。
2. **顯示已存的備註/關閉原因/承辦**：卡片上顯示 `staffNote`、`closeReason`、`assignedStaffId`（若有），讓審核有脈絡。
3. **載入骨架**：`載入中…` → 共用 `SkeletonList`（與 console 頁一致）。
4. 稽核：`updateStatus`/`assign` 既有 `logAudit` 已涵蓋狀態轉移；`moderation_events` 的 action enum 僅 submit/approve/reject，與媒合狀態語意不合，故不硬套（維持 audit_logs）。

## 為何不新增「approve/reject」語意

媒合意向的生命週期是 `new → staff_handling → introduced → matched | closed`，本質是**承辦推進**而非「准/駁」。硬加審核准駁反而扭曲模型。真正缺的是「承辦能不能記錄處理過程與關閉原因」——這批補上了。

## 測試

- 前端元件 `client/src/pages/MatchRequests.test.tsx`：載入骨架、備註/關閉原因送出（`getMutation("matchRequests.updateStatus")` 驗 payload）、狀態切換。
