# 業務線索管線 — 媒合平台規格增補（§7.5 延伸）

| 項目     | 內容                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| 文件版本 | v1.0（2026-07-23）                                                                       |
| 狀態     | 提案（待拍板落入 P1–P3）                                                                 |
| 定位     | 補齊 `marketplace-platform-spec.md` §7.5「媒合與聯繫（仲介居中）」的**後半段**           |
| 基礎     | 建在現有 `match_requests`（已實作，`drizzle/schema.ts:874`）之上，additive，不改既有語意 |

---

## 1. 為什麼要這份文件

第一階段的商業模式是 **線索生成（lead-gen）→ 業務手動媒合**：使用者點「我有需求／我有興趣」→ 生成一筆 `match_requests` → **派業務接手聯絡**，媒合由業務居中完成（非系統自動推薦，對齊 §4.2）。

主規格把**入口（點擊）**與**媒合狀態機**寫清楚了，但「點擊之後、業務接手前後」的一條完整線索旅程只有淺淺帶過。少了它，線索會爛在佇列裡、業務空手打電話、成交率無從量測（第二階段要收費時**沒有轉換基準可定價**）。

本文件把這後半段釘成 **狀態機 + 資料模型**。

---

## 2. 六個關鍵時刻（旅程缺口）

| #   | 時刻           | 缺口                                            | 本文件對策                                        |
| --- | -------------- | ----------------------------------------------- | ------------------------------------------------- |
| 1   | 按完後的空窗期 | 沒抓聯絡偏好；沒有「已收到」回覆                | `preferredChannel/preferredTime` + 即時 ack 通知  |
| 2   | 業務打開線索   | 手上沒有情境包（人是誰、按了什麼、講什麼語言）  | `matchRequests.detail` 情境包（read-model）       |
| 3   | 首次接觸速度   | 無指派邏輯、無 SLA、聯繫不到無重試              | `slaDueAt` + `contactStatus` + 活動時間軸         |
| 4   | 雙邊接續       | 對面那一方（雇主/移工）沒人去接；標的可能已失效 | 由 `target` 推導 counterpart + `targetStale` 旗標 |
| 5   | 重複線索       | 同一人按很多個 → 被拆成多筆分派給多位業務       | `mergedIntoId` 去重 + 以 `initiatorUserId` 收斂   |
| 6   | 結果回收       | 未記錄成交/未成交原因 → 無法排優先、無轉換基準  | `outcome` 結案分類 + 活動軌跡                     |

---

## 3. 狀態機（v2）

維持既有 5 段 pipeline `status`**不動**（避免 enum 遷移風險），改用**兩個正交維度 + 結案分類**把細節補上：

### 3.1 業務階段（沿用既有 `status`）

```
new → staff_handling → introduced →┬─ matched
                                   └─ closed
```

- `new` 新進（尚未指派/未接手）
- `staff_handling` 已指派、處理中
- `introduced` 雙邊皆已引介、進入實際媒合
- `matched` 成交 → 對應後台 case 推進僱傭流程
- `closed` 關閉（不成/取消/無法聯繫）

### 3.2 觸及狀態（新增 `contactStatus`，與階段正交）

```
pending → attempting →┬─ reached
                      └─ unreachable
```

把「聯繫不到」從 pipeline 拆開:一筆線索可以是 `staff_handling` 但 `unreachable`,或 `introduced` 且 `reached`。SLA 與重試都掛在這維度。

### 3.3 結案分類（新增 `outcome`，於 matched/closed 時填）

| outcome             | 意義                             |
| ------------------- | -------------------------------- |
| `matched`           | 成交                             |
| `unreachable`       | 多次嘗試仍聯繫不到               |
| `declined_worker`   | 移工方婉拒                       |
| `declined_employer` | 雇主方婉拒                       |
| `ineligible`        | 資格不符（如雇主無看護聘僱資格） |
| `target_closed`     | 標的已失效（職缺成交/下架）      |
| `duplicate`         | 與既有線索重複，已併入           |
| `other`             | 其他（`closeReason` 補自由文字） |

---

## 4. 資料模型變更（additive）

### 4.1 擴充 `match_requests`（沿用 int PK / timestamp / int-as-bool 慣例）

| 欄位               | 型別                                                                       | 用途                                          |
| ------------------ | -------------------------------------------------------------------------- | --------------------------------------------- |
| `preferredChannel` | `enum('phone','line','whatsapp','zalo','email')` null                      | 偏好聯絡管道（intake 捕捉；移工重 Zalo/LINE） |
| `preferredTime`    | `enum('anytime','daytime','evening','weekend')` null                       | 可聯絡時段（避免打擾工作中的看護）            |
| `contactStatus`    | `enum('pending','attempting','reached','unreachable')` default `'pending'` | 觸及狀態（§3.2）                              |
| `firstContactedAt` | `timestamp` null                                                           | 首次接觸時間（算接觸速度）                    |
| `contactAttempts`  | `int` default `0`                                                          | 嘗試次數                                      |
| `lastAttemptAt`    | `timestamp` null                                                           | 最後一次嘗試                                  |
| `slaDueAt`         | `timestamp` null                                                           | 首次接觸期限（建立時 + SLA 計算）             |
| `assignedAt`       | `timestamp` null                                                           | 指派時間（`assignedStaffId` 已存在）          |
| `outcome`          | `enum(...§3.3)` null                                                       | 結案分類                                      |
| `mergedIntoId`     | `int` null                                                                 | 去重:併入的主線索 id（self-ref）              |
| `targetStale`      | `int` default `0`                                                          | 標的已失效旗標（0/1）                         |
| `inquiryCategory`  | `enum('caregiver','domestic_helper','other','unsure')` null                | 開放諮詢職類意向（§8;無標的時的摘要來源）     |
| `inquiryCity`      | `varchar(20)` null                                                         | 開放諮詢地區（§8）                            |

`targetType` enum 增 `general_inquiry`（開放諮詢,`targetId=0`,§8）。

> 既有 `assignedStaffId / note / staffNote / closeReason` 續用。`closeReason` 保留作 `outcome=other` 的自由文字補充。

新增索引:`(assignedStaffId, status)`（業務工作台）、`(contactStatus)`、`(slaDueAt)`（逾期掃描）。

### 4.2 新表 `match_request_activities`（業務線索時間軸）

審核軌跡（`moderation_events` / `audit_logs`）是**合規稽核**;業務跟進軌跡是**銷售時間軸**,兩者用途不同,獨立成表。

| 欄位             | 型別                                                                                       | 說明                      |
| ---------------- | ------------------------------------------------------------------------------------------ | ------------------------- |
| `id`             | int PK                                                                                     |                           |
| `matchRequestId` | int notNull                                                                                | → `match_requests.id`     |
| `staffId`        | int null                                                                                   | 操作者（系統事件為 null） |
| `type`           | `enum('assigned','contact_attempt','reached','note','status_change','counterpart_linked')` | 事件類型                  |
| `channel`        | `enum('phone','line','whatsapp','zalo','email')` null                                      | 該次接觸管道              |
| `note`           | text null                                                                                  | 內容                      |
| `createdAt`      | timestamp defaultNow                                                                       |                           |

索引:`(matchRequestId)`。此表同時餵養:業務工作台時間軸、SLA/接觸速度指標、媒合漏斗看板（§12 可觀測性）。

---

## 5. 服務層邏輯（無需新表）

- **情境包 `matchRequests.detail`**:一支 read-model procedure,join 發起者公開資料 + 標的（職缺/移工匿名履歷）+ `content_translations` + 活動時間軸,讓業務一開就有彈藥。**遵守 §11**:私密 PII 僅在揭露後、對承辦業務可見。
- **指派**:建立時 `status=new`;派工可手動或依 **地區/語言/職類** 輪派 → 寫 `assignedStaffId/assignedAt`,`status→staff_handling`,記一筆 `type=assigned` 活動,並依 SLA 設 `slaDueAt`。
- **SLA 逾期掃描**:排程掃 `slaDueAt < now 且 firstContactedAt is null` → 提醒/回收重派（沿用現有夜間批次/通知基建）。
- **雙邊接續**:一筆 `match_requests` 代表**單邊**意向。業務由 `targetType/targetId` 推導對面（`job_posting → 雇主`、`worker → 移工帳號`),接洽後記 `type=counterpart_linked`,雙邊皆 `reached` 才可推進 `introduced`。
- **標的新鮮度**:送出時即時驗證標的仍有效(職缺 `moderationStatus=approved` 且未 `filled/closed`);背景批次把已失效標的的在途線索標 `targetStale=1` 供業務優先處理。
- **去重**:同 `initiatorUserId` 的多筆意向在工作台**收斂為一段關係**由同一業務承辦;明確重複者以 `mergedIntoId` 併入主線索並 `outcome=duplicate` 結案。

---

## 6. 對申請者端的旅程（閉環）

1. 點「我有需求／我有興趣」→ 追問**偏好聯絡管道 + 時段**（1–2 題,不擋送出）。
2. **立即 ack**:站內 + Email/WhatsApp「已收到,X 個工作日內由專員聯繫」（承接 §7.7,ack 屬第一階段必備,不等 P3）。
3. **自助查進度**（輕量）:「我的諮詢」頁顯示 `處理中／已聯繫／已安排` 概況,降低「你們收到了嗎」的重複詢問。

---

## 7. 分期落點

| 階段 | 納入                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------ |
| P1   | `preferredChannel/preferredTime` 捕捉 + 即時 ack + 標的新鮮度驗證 + **§8 開放諮詢入口（`general_inquiry`，登入才送出）** |
| P3   | 完整管線:`contactStatus`/SLA/`assignedAt`/活動時間軸/`outcome`/去重 + 業務工作台 + 漏斗看板                              |
| —    | `matchRequests.detail` 情境包隨對應頁面實作                                                                              |

> P1 先把「捕捉 + ack + 不推失效標的」這幾個**低成本高轉換**的點做掉;完整銷售管線隨 P3 媒合模組落地。

---

## 8. 開放式「諮詢」入口（納入第一階段，共用同一條管線）

> **決策（2026-07-23）**:納入第一階段;**送出需登入**（沿用 §15-1「瀏覽開放、聯絡才登入」,重用 `match_requests` 與 my-interests/ack 基建,降低垃圾線索）。

目前入口都綁特定標的（職缺/移工）。開放諮詢處理**無標的的上游意圖**——雇主「我想請看護,流程/費用?」、外籍工作者「我想換雇主,有什麼選擇?」——這正是「藉由平台諮詢」最寬的漏斗頂端。

### 8.1 設計

- **共用管線**:在 `targetType` 增 `general_inquiry`（`targetId = 0`,無標的），整條管線（指派/狀態/結案分類/佇列/我的意向）全部沿用,不另建系統。
- **登入 gating**:諮詢表單頁**開放瀏覽**;點「送出諮詢」時未登入 → 導 `/login?next=/inquiry`（與 JobDetail 一致）。送出走 `protectedProcedure`。
- **表單欄位**（皆輕量,不擋送出）:
  - `inquiryCategory`（必填）:`caregiver` / `domestic_helper` / `other` / `unsure`（沿用公開三桶 + 「還不確定」）。
  - `inquiryCity`（選填）:台灣縣市（`TW_CITIES`）。
  - `note`（選填）:自由描述問題。
  - `preferredChannel` / `preferredTime`（選填）:聯絡偏好（§4.1 共用欄位）。
  - `initiatorType` 由 `accountType` 推導（worker / employer / other）。
- **去重**:一個使用者同時只允許**一筆進行中**的開放諮詢（`getOpenMatchRequest` 以 `targetId=0` 天然收斂）;已 `matched/closed` 者不算,可再送。回 `alreadySent` 提示。
- **摘要顯示**:`general_inquiry` 無標的,佇列與「我的意向」的去識別摘要改由 `inquiryCategory`/`inquiryCity` 直接組出,label =「免費諮詢」。
- **入口**:首頁 hero 常駐 CTA「免費諮詢」+ 公開站導覽列;送出後沿用即時 ack 與「我的意向」查進度。

### 8.2 不在本期（沿用主管線後續階段）

SLA/`contactStatus`/活動時間軸/業務工作台隨 §7 的 P3 一併套用到含 `general_inquiry` 的所有線索;本期只做「捕捉 + 入列 + ack + 我的意向可見」。

---

## 9. 待拍板

1. **SLA 時數**:首次接觸幾小時內?（建議營業時間 4 小時內,對齊 §15-4 審核 1 工作日的更緊版本）→ P3
2. **輪派規則**:地區 / 語言 / 職類 何者優先?是否綁定「該業務會講的語言」?→ P3
3. **聯絡偏好存放**:僅存線索快照,或同步回 `users` 供跨線索重用?（本期先存線索快照）
4. ~~**§8 開放諮詢入口**是否納入第一階段~~ → **已定案納入（2026-07-23，登入才送出）**。
