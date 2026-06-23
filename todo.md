# 移工與客戶管理後台 TODO

## 資料庫 Schema
- [x] 設計 workers 表（移工）
- [x] 設計 customers 表（客戶）
- [x] 設計 managers 表（負責人）
- [x] 執行資料庫遷移

## 後端路由（tRPC）
- [x] managers router：list / create / delete
- [x] workers router：list / create / update / delete / getById
- [x] customers router：list / create / update / delete / getById
- [x] 後端驗證：必填欄位、格式、唯一性
- [x] 跨欄位邏輯驗證（在職 + 文件狀態）
- [x] 台灣統一編號檢查碼驗證
- [x] 台灣電話格式驗證
- [x] 居留證 / 護照格式驗證

## 前端頁面
- [x] DashboardLayout（側邊欄導航）
- [x] 移工列表頁（表格、搜尋、負責人篩選、統計卡）
- [x] 移工新增 Modal
- [x] 移工編輯 / 刪除詳情頁
- [x] 客戶列表頁（表格、搜尋、負責人篩選、統計卡）
- [x] 客戶新增 Modal
- [x] 客戶編輯 / 刪除詳情頁
- [x] 負責人設定頁（新增 / 刪除）
- [x] 狀態配色系統（綠 / 琥珀 / 紅 / 灰）
- [x] RWD 桌機與平板版面

## 資料
- [x] 塞入 8–10 筆移工範例資料（共 10 筆）
- [x] 塞入 5–8 筆客戶範例資料（共 7 筆）
- [x] 塞入預設負責人（Jacob、Lulu、Erlina、Brian、小白、羅sir、Robert）

## 測試驗收
- [x] 新增完整資料後確認寫入資料庫並出現在列表
- [x] 編輯頁欄位正確帶入舊值
- [x] 編輯儲存後刷新仍保留
- [x] 狀態切換後列表標籤同步更新
- [x] 刪除後從列表移除
- [x] 必填欄位留空被擋下
- [x] 錯誤格式證號 / 電話 / 統編被擋下
- [x] 重複證號 / 統編被擋下
- [x] 在職 + 待補件跨欄位驗證
- [x] 編輯自身不被誤判為重複
- [x] 搜尋篩選正確
- [x] 負責人篩選正確
- [x] 統計卡數字與實際資料一致
- [x] RWD 版面不跑版
- [x] Vitest 測試：25 個測試全部通過

## 易用性優化（v1.1）
- [x] Enter 鍵切換欄位（IME 安全，中文輸入不觸發）
- [x] Modal 開啟自動 focus 第一個欄位
- [x] 備註 Textarea 保留 Enter 換行功能
- [x] 搜尋框 Escape 清除 + 右側清除按鈕（X）
- [x] 移工頁加入生命週期與文件狀態篩選下拉
- [x] 客戶頁加入合約狀態與定價級距篩選下拉
- [x] 統計卡點擊快速篩選（再點一次取消）
- [x] 篩選中顯示標籤 + 單項清除 + 清除全部篩選
- [x] 搜尋支援姓名、證號、國籍、負責人、統編、產業、聯絡窗口
- [x] 列表行雙擊開啟編輯 Modal
- [x] 表格 header 樣式優化（行高、hover 更明顯）
- [x] 空狀態顯示圖示與說明文字
- [x] 修正 /workers 路由 404 問題

## 居留證到期提醒（v1.2）
- [x] Schema 新增 idExpiryDate 欄位（varchar，可選）
- [x] 執行資料庫遷移
- [x] 後端 workers router 支援 idExpiryDate 讀寫與格式驗證
- [x] WorkerModal 新增「證件到期日」日期欄位（與入境日期並排）
- [x] 更新範例資料，涵蓋已過期、30 天內、90 天內、遠期四種情境
- [x] Workers.tsx 統計卡新增「30 天內到期」卡片，紅色顯示
- [x] Workers.tsx 到期篩選下拉（30 天內、90 天內、已過期）
- [x] 篩選標籤顯示琥珀色標記，可單獨清除
- [x] 列表到期日顯示剩餘天數，30 天內紅色，90 天內琥珀色
- [x] 到期移工姓名旁顯示「到期」小標籤，列表行淡紅色背景
- [x] 25 個 Vitest 測試全部通過

## 通知鈴鐺（v1.3）
- [x] DashboardLayout header 加入通知鈴鐺按鈕（右上角）
- [x] 下拉顯示 90 天內到期與已過期移工名單（依緊急程度排序）
- [x] 每筆通知顯示姓名、到期日、剩餘天數、負責人
- [x] 未讀數量 badge（紅點顯示 30 天內 + 已過期總數）
- [x] 點擊通知項目導航至移工管理並自動套用到期篩選
- [x] 底部顯示已過期/30天內分類計數 + 查看全部連結
- [x] 無到期通知時顯示空狀態（CheckCheck 圖示）
- [x] Escape 鍵與點擊外部自動關閉下拉

## 連結欄位與 CSV 匯入（v1.4）
- [x] Schema 新增 externalLink 欄位（varchar(500), nullable）並執行遷移
- [x] 後端 routers.ts 支援 externalLink 讀寫與 URL 格式驗證（http/https）
- [x] WorkerModal 新增「連結」欄位（URL 格式驗證、旁邊顯示「開啟」按鈕）
- [x] Workers.tsx 列表頁姓名旁顯示連結小圖示（可點擊開新分頁）
- [x] CSV 匯入：後端 workers.import 批次寫入 procedure（逐筆驗證，回傳成功/失敗明細）
- [x] CSV 匯入：前端 ImportWorkerModal 元件（上傳/拖放 → 解析預覽 → 確認匯入）
- [x] CSV 範本下載（含欄位說明、中文映射表、超前 BOM UTF-8）
- [x] 匯入結果回報（成功 N 筆、失敗 N 筆與原因明細）
- [x] 25 個 Vitest 測試全部通過

## 移工欄位全面改版 v2.0（對齊 Ragic 外國人資料表）

### Schema 擴充
- [x] 新增：英文姓名、中文姓名（拆分原姓名欄位）
- [x] 新增：出生日期、性別（下拉）、職業（下拉）、出生地點
- [x] 新增：統一證碼（居留證號）、護照號碼（獨立欄位）
- [x] 新增：居留證有效日期、護照有效日期
- [x] 新增：電子信箱
- [x] 新增：最近一次體檢日期、下次需要體檢類型（下拉）
- [x] 新增：大頭照、母國身分證(KTP)、居留證正面、居留證被面、護照、護照入境頁、體檢報告（S3 key 欄位）
- [x] 執行資料庫遷移

### 後端路由
- [x] 更新 workerInput schema 包含所有新欄位
- [x] 新增 S3 上傳 API（workers.uploadFile）
- [x] 自動計算欄位邏輯（下次體檢日、剩餘天數）前端即時計算顯示

### 前端 WorkerModal 重構
- [x] 分區段表單：基本資料 / 證件資料 / 聯絡資料 / 體檢資料 / 附件上傳
- [x] 圖片上傳元件（預覽縮圖、點擊放大、刪除）
- [x] 檔案上傳元件（PDF 等，顯示檔名與刪除）
- [x] 自動計算欄位唯讀顯示（下次體檢日、各剩餘天數）
- [x] 國籍下拉含國碼（印尼009、越南084等）

### 列表頁與通知
- [x] 通知鈴鐺新增護照到期提醒（90天內）
- [x] 通知鈴鐺新增體檢到期提醒（30天內）
- [x] 列表頁更新欄位顯示（統一證碼/護照號碼）
- [x] 30 個 Vitest 測試全部通過

## 附件上傳 Bug 修正（v2.1）
- [x] Bug 修正：KTP、居留證正面、居留證背面、護照、護照入境頁加上 `accept="image/*"`（原本預設為 `image/*,application/pdf`，可選到 PDF）
- [x] Bug 修正：前端 FileUploadField 加入 `validateFileType` 函數，選取不符合類型的檔案時立即顯示 toast 錯誤
- [x] Bug 修正：前端 sanitize 檔名為 `file_${Date.now()}.${ext}` 純 ASCII 格式，避免中文檔名導致 S3 presign 400 錯誤
- [x] 30 個 Vitest 測試全部通過，TypeScript 零錯誤

## 客戶管理全面改版 v3.0（對齊 Ragic 雇主資料表）

### Schema 擴充（35 個新欄位）
- [x] employerType：個人雇主 / 公司行號
- [x] 個人雇主：employerNo、phone、landline、address、registeredAddress、referrer、idNo、preCourseNo、idFrontKey、idBackKey
- [x] 被照顧者：careReceiverNo、careReceiverName、careReceiverBirthDate、careReceiverIdNo、careReceiverAddress、careReceiverQualification、careReceiverRelation、careReceiverIdFrontKey、careReceiverIdBackKey
- [x] 媒合案件：caseNo、caseStatus
- [x] 申請資格：jobSeekerType、jobSeekerDate、jobSeekerFileKey、recruitmentLetterType、recruitmentLetterDate、recruitmentLetterFileKey、recruitmentPermitNote、recruitmentPermitDays、previousWorkerDepartureDate
- [x] 聘僱函：employmentLetterType、employmentLetterDate、employmentLetterFileKey、approvedStartDate、approvedPeriod、approvedEndDate
- [x] 執行資料庫遷移

### 後端路由
- [x] 更新 customerInput schema 包含所有新欄位
- [x] 新增 customers.uploadFile S3 上傳 API
- [x] create / update mutation 傳入所有新欄位

### 前端 CustomerModal 重構
- [x] 雙類型切換按鈕（個人雇主 / 公司行號）
- [x] 分區段表單：申請人基本資料 / 被照顧者基本資料（個人）/ 媒合案件 / 申請資格 / 聘僱函 / 系統管理
- [x] 個人雇主：身分證正反面圖片上傳（accept="image/*"）
- [x] 被照顧者：身分證正反面圖片上傳（accept="image/*"）
- [x] 求才資格、招募函許可、聘僱函：PDF/圖片附件上傳
- [x] 編輯時正確還原所有欄位值與附件

### 列表頁更新
- [x] 統計卡新增個人雇主 / 公司行號數量卡（可點擊快速篩選）
- [x] 篩選列新增「雇主類型」下拉
- [x] 表頭更新：名稱 / 類型 / 編號 / 電話 / 合約狀態 / 負責人 / 案件狀態
- [x] 列表行顯示雇主類型 badge（個人藍色 / 公司紫色）
- [x] 搜尋支援雇主編號、身分證字號、電話
- [x] 30 個 Vitest 測試全部通過，TypeScript 零錯誤

## 詳情頁模組 v4.0

- [ ] WorkerDetail 移工詳情頁：完整資料展示、附件預覽、關聯案件清單
- [ ] CustomerDetail 客戶詳情頁：個人/公司雙類型、被照顧者資料、關聯案件清單
- [ ] Workers 列表行可點擊跳轉 /workers/:id
- [ ] Customers 列表行可點擊跳轉 /customers/:id
- [ ] Cases 列表行確認點擊行為一致（已有詳情頁）
- [ ] App.tsx 新增 /workers/:id 與 /customers/:id 路由
- [ ] 後端 workers.getById 補充關聯案件查詢
- [ ] 後端 customers.getById 補充關聯案件查詢
