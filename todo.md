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

- [x] WorkerDetail 移工詳情頁：完整資料展示、附件預覽、關聯案件清單
- [x] CustomerDetail 客戶詳情頁：個人/公司雙類型、被照顧者資料、關聯案件清單
- [x] Workers 列表行可點擊跳轉 /workers/:id
- [x] Customers 列表行可點擊跳轉 /customers/:id
- [x] Cases 列表行確認點擊行為一致（已有詳情頁）
- [x] App.tsx 新增 /workers/:id 與 /customers/:id 路由
- [x] 後端 workers.getById 補充關聯案件查詢
- [x] 後端 customers.getById 補充關聯案件查詢

## UI/效能優化（v4.1）

- [x] 統一頁面標題字級：Workers.tsx、Customers.tsx 標題改為 text-2xl font-semibold tracking-tight
- [x] 側邊欄 active 高亮：index.css 補充 --sidebar-accent CSS 變數，DashboardLayout 加強 active 樣式（font-medium + 左側指示線）
- [x] 效能優化：QueryClient 全域快取（staleTime 5分鐘、refetchOnWindowFocus false）
- [x] 效能優化：WorkerDetail 和 CustomerDetail 加入 initialData 從列表快取取得資料
- [x] 30 個 Vitest 測試全部通過，TypeScript 零錯誤

## 雙向導航 + 案件假資料（v4.2）

- [x] 案件假資料：7 個案件、6 筆資格、9 筆需求、5 個媒合批次、11 筆媒合成員、3 筆正式聘僱
- [x] workerInvolvements 後端補充 customerId、workerName 欄位
- [x] WorkerDetail 關聯案件卡片加入客戶連結（點擊跳轉 /customers/:id）
- [x] CustomerDetail 關聯案件卡片加入移工名列表（點擊跳轉 /workers/:id）
- [x] 30 個 Vitest 測試全部通過，TypeScript 零錯誤

## 案件管理 Phase 1：基本資料重構（v5.0）

- [x] Schema：cases 主表新增 caseNo、primaryWorkerId、needsReview、recruitmentPermitFileKey
- [x] Schema：執行資料庫遷移
- [x] 後端：cases.list / getById / create / update 支援新欄位
- [x] 後端：案件編號自動產生邏輯（GVC25-YYYYMMDD-NNN）
- [x] 後端：cases.getById 回傳雇主完整資料（電話/地址/被照顧者）
- [x] 後端：cases.getById 回傳主要移工完整資料（姓名/證件/手機）
- [x] 前端 CaseModal：選雇主下拉 → 自動帶入電話、地址、被照顧者姓名/資格（唯讀）
- [x] 前端 CaseModal：選移工下拉 → 自動帶入中英文姓名、居留證號、護照號、有效日期、手機（唯讀）
- [x] 前端 CaseModal：招募許可函附件上傳（S3）
- [x] 前端 CaseModal：需檢查標記 checkbox
- [x] 前端 CaseDetail：基本資料 Tab 顯示自動帶入的雇主/移工資訊（含跳轉連結）
- [x] 前端 Cases 列表：顯示案件編號欄位
- [x] 30 個 Vitest 測試全部通過，TypeScript 零錯誤

## 案件管理 Phase 2：聘僱時間與代辦事項（v5.1）

- [x] Schema：cases 主表新增 continuousEmploymentDate、employmentPeriodMonths、terminationDate、recruitmentAgencyItems、employmentAgencyItems、postEmploymentInsurance、employmentPermitFileKey、employmentStatus、terminationLetterFileKey
- [x] Schema：執行資料庫遷移
- [x] 後端：cases CRUD 支援新欄位
- [x] 前端 CaseModal：新增「聘僱資料」分區（日期選擇、代辦事項下拉、附件上傳）
- [x] 前端 CaseDetail：基本資料 Tab 新增聘僱時間與代辦事項卡片
- [x] 30 個 Vitest 測試全部通過，TypeScript 零錯誤

## 案件管理 Phase 3：通報/移民署/勞動部許可函（v5.2）

- [x] Schema：cases 主表新增 notificationNo、entryNotificationDate、certificateNo（承接通報/入國通報）
- [x] Schema：cases 主表新增 niaCategory、niaNo、residencePermitSubmitDate（內政部移民署）
- [x] Schema：cases 主表新增 molReceiptNo、employmentLetterCategory、applicationSubmitDate、issuanceDate、approvalReceiptDate（勞動部聘僱許可函）
- [x] Schema：執行資料庫遷移（11 個欄位全部加入）
- [x] 後端：cases CRUD 支援新欄位
- [x] 前端 CaseModal：新增「承接通報/入國通報」分區（通報書序號、入國通報申請日、證明書序號）
- [x] 前端 CaseModal：新增「內政部移民署」分區（一站式類別、一站式序號、居留證申請送審日）
- [x] 前端 CaseModal：新增「勞動部聘僱許可函」分區（收文號、聘僱函類別、申請書送件日、發文日期、核准收件日）
- [x] 前端 CaseDetail：基本資料 Tab 新增三個行政流程卡片
- [x] 30 個 Vitest 測試全部通過，TypeScript 零錯誤

## 效能優化 + 體檢管理（v5.3）

- [x] 效能：案件列表後端改為批次查詢（getCaseDimensionsBatch），消除 N+1
- [x] 效能：CaseMatchingTab 和 CaseEmploymentTab 延遲載入（modal 開啟時才查詢）
- [x] 效能：caseQualifications.listByCase 改用 getQuotaUsedBatch，消除 Nxd72 查詢
- [x] 效能：Cases.tsx 搜尋輸入加入 300ms debounce
- [x] 體檢 Schema：cases 主表新增 10 個體檢欄位（prevMedicalExamDate、entryMedicalExamDate、exam6m/18m/30m + 報告附件 key）
- [x] 體檢後端：cases CRUD 支援體檢欄位
- [x] 體檢前端 CaseModal：新增「體檢管理」分區（日期 + 附件上傳）
- [x] 體檢前端 CaseDetail：基本資料 Tab 新增體檢管理卡片
- [x] 30 個 Vitest 測試全部通過，TypeScript 零錯誤

## 保險管理 + 列表計數補完（v5.4）

- [x] Schema：cases 主表新增 healthInsuranceEnrollDate、healthInsurancePolicyKey、accidentInsuranceEnrollDate、accidentInsurancePolicyKey
- [x] 資料庫遷移執行成功
- [x] 後端：cases CRUD 支援保險欄位
- [x] 後端：cases.list 已有子表 COUNT 批次查詢（getCaseDimensionsBatch）
- [x] 前端 CaseModal：新增「保險管理」分區（健保投保日期、意外險投保日期、保單附件上傳）
- [x] 前端 CaseDetail：基本資料 Tab 新增保險管理卡片
- [x] 前端 Cases.tsx：列表計數欄位已正確顯示（getCaseDimensionsBatch 批次查詢）
- [x] 30 個 Vitest 測試全部通過，TypeScript 零錯誤

## 關聯案件快速新增（v5.5）

- [x] Cases.tsx 讀取 URL 參數 ?customerId=X 或 ?workerId=X，自動開啟 CaseModal 並預填對應欄位
- [x] CaseModal 支援 defaultCustomerId 和 defaultWorkerId props，預填後唯讀顯示
- [x] WorkerDetail 關聯案件區塊新增「+ 新增案件」按鈕，點擊直接嵌入 CaseModal
- [x] CustomerDetail 關聯案件區塊新增「+ 新增案件」按鈕，點擊直接嵌入 CaseModal
- [x] 新增案件後 onSuccess 回調自動刷新關聯案件列表

## 資料匯入後 UI 修正（v5.6）

- [x] 國籍代碼統一：「009 印尼」→「印尼」（資料庫 UPDATE + constants.ts + WorkerModal 同步）
- [x] 客戶列表：employerNo/contractStatus 補更新，類型欄位「個人」→「個人雇主」，隱藏空定價篩選器
- [x] 職業欄位：OCCUPATION_OPTIONS 移至 constants.ts（共用），WorkerDetail 職業欄位改為顯示中文 label（家庭看護工 等），WorkerModal 改為從 constants.ts import
- [x] CaseModal Tab 驗證錯誤 Badge：必填欄位未填時，對應 Tab 標籤顯示紅色錯誤數量（基本資料 Tab 包含案件名稱/負責人/雇主共 3 個必填欄位）

## Loading 動畫統一（v5.9）

- [x] 建立共用 PageSkeleton 元件（詳情頁用：標題 + 副標題 + 卡片群）
- [x] 建立共用 TableRowSkeleton 元件（列表頁表格 row 用）
- [x] 建立共用 InlineLoader 元件（Settings 等小區塊用：spinner + 載入中...）
- [x] Workers.tsx：改用 TableRowSkeleton
- [x] Customers.tsx：改用 TableRowSkeleton
- [x] Cases.tsx：改用 TableRowSkeleton
- [x] WorkerDetail.tsx：改用 PageSkeleton
- [x] CustomerDetail.tsx：改用 PageSkeleton
- [x] CaseDetail.tsx：改用 PageSkeleton
- [x] Settings.tsx：改用 InlineLoader

## CaseModal 建立案件 validation 錯誤修正（v5.10）

- [x] 修正 cases.create server-side input schema：Tab 2 所有選填欄位加上 .nullable()，enum 欄位加 transform(v => v ?? undefined)，解決前端送出 null 時的 invalid_type/invalid_value 錯誤
- [x] 確認 cases.update 已有 .nullable()，不需修改
- [x] TypeScript 零錯誤驗證通過

## CaseModal Disabled 按鈕 + 未填提示（v5.11）

- [x] 計算必填欄位缺少清單（name、managerId、customerId）
- [x] 建立案件按鈕在必填未填時 Disabled
- [x] 按鈕旁加入 Tooltip 列出尚未填寫的欄位名稱
- [x] 編輯模式（editingCase）不套用 Disabled 邏輯（允許部分更新）

## WorkerModal / CustomerModal Disabled 按鈕 + Tooltip（v5.12）

- [x] WorkerModal：加入 Tooltip import，計算 missingFields（nameCn/nameEn、managerId），Disabled 按鈕 + Tooltip
- [x] CustomerModal：加入 Tooltip import，計算 missingFields（name、contractStatus、pricingTier、managerId），Disabled 按鈕 + Tooltip

## 移工詳情頁附件 Lightbox / PDF 預覽（v5.13）

- [x] 建立共用 AttachmentPreviewModal 元件（圖片 Lightbox + PDF iframe inline）
- [x] WorkerDetail.tsx：AttachmentItem 改為點擊開啟 AttachmentPreviewModal
- [x] 預覽 Modal 支援鍵盤 Esc 關閉、點擊背景關閉、下載、新分頁開啟

## 即將到期文件視覺提醒（v5.16）

- [x] ~~server-side：workers.getExpiringDocuments procedure~~（已由 dashboard.summary 的 expiringDocuments 內建取代，不另立 procedure）
- [x] Dashboard：「證件到期提醒」區塊（居留證/護照，已過期或 60 天內）
- [x] CaseDetail：加入案件的法定合規提醒 Banner（見「法定合規引擎」章節）
- [x] 到期狀態色彩規則統一：已過期=紅、14 天內=橙紅、30 天內=橙、90 天內=黃（client/src/lib/expiry.ts）

## 法定合規引擎（健檢 6/18/30 個月 + 聘僱許可續聘）

背景：曾因「工作滿 6 個月定期健檢逾期」收到新北市衛生局移送公文。

- [x] shared/healthCheck.ts：定期健檢窗口引擎（起始日 approvedStartDate + 6/18/30 個月，前後 30 日窗口，提前 45 天提醒）
- [x] shared/healthCheck.ts：classifyDeadline 固定到期日分級器（聘僱許可續聘用，提前 120 天/60 天內緊迫）
- [x] 健檢資料分兩處：移工檔 lastMedicalExamDate 落在窗口內即視為完成（recordedSource=worker），避免誤判逾期
- [x] server：getComplianceCandidates 查詢 + dashboard.compliance procedure（合併健檢與聘僱許可，回傳分級清單）
- [x] 聘僱許可續聘：以 approvedEndDate 為到期日，缺值時由起始日 + 期間月數推算；已終止案件不提醒
- [x] NotificationBell + Dashboard：改吃 dashboard.compliance；移除錯誤的「上次體檢 + 5 個月」公式
- [x] CaseDetail：頂部合規 Banner + 體檢卡片 6/18/30 列就地標示逾期/辦理中
- [x] workers.nextMedicalExamType 標為 deprecated（改由引擎推算，欄位保留相容）
- [x] 測試：引擎 25 個、路由 21 個
- [ ] （未做）主動 email 排程通知負責人——真正「零漏接」的關鍵，不靠登入看鈴鐺
- [ ] （未做）體檢日期欄位根本統一（移工層 vs 案件層），目前靠引擎 fallback 相容

## CSV 匯出功能（v5.17）

- [x] 建立共用 exportToCsv 工具函數（BOM + UTF-8，支援 Excel 中文正常顯示）
- [x] Workers.tsx：加入「匯出 CSV」按鈕，匯出目前篩選的移工資料（20 個欄位）
- [x] Customers.tsx：加入「匯出 CSV」按鈕，匯出目前篩選的客戶資料（24 個欄位）
- [x] Cases.tsx：加入「匯出 CSV」按鈕，匯出目前篩選的案件資料（25 個欄位）
- [x] 匯出欄位含 label 轉換（enum → 中文）、日期格式化、空值顯示「—」

## 通知點擊導航至移工詳情頁 + 高亮到期文件（v5.18）

- [x] NotificationBell：點擊通知項目改為導航至 /workers/:workerId?highlight=resident|passport|medical
- [x] WorkerDetail：讀取 URL ?highlight= 參數，自動滾動至對應証件區塊
- [x] WorkerDetail：高亮動畫（橙色邊框 + 背景閃爍 2 秒）標示到期文件卡片

## 居留證號碼重複檢查（v5.20）

- [x] server-side workers.create：查詢 DB 是否已有相同 residentPermitNo，有則拋出 CONFLICT 錯誤
- [x] server-side workers.update：同上，但排除自身 id（允許更新為相同號碼）
- [x] 前端 WorkerModal：捕捉 CONFLICT 錯誤，在居留證/護照欄位下方顯示紅色 AlertCircle + 提示文字

## 品牌視覺導入 Phase 1（規劃與預覽）

- [x] 掃描現有平台關鍵頁面（DashboardLayout、Workers、Customers、Cases、詳情頁、NotFound、Home）
- [x] 產出全站視覺落點盤點表（位置 ↔ 資產 ↔ 姿態）
- [x] 繪製 Logo SVG React 元件（燕子剪影，品牌主色 #1FA59B）
- [x] 繪製吉祥物四姿態 SVG React 元件（比讚/揮手/文件審閱/慶祝）+ 新增疑惑/搜尋兩種缺漏姿態
- [x] 建立 /brand-preview 預覽路由（展示 Logo、吉祥物、色票、套用範例）
- [x] 產出元件 API 提案（Logo variant/size、Mascot pose/size、EmptyState props）
- [x] 產出缺漏姿態清單（四姿態以外需要的新姿態）
- [x] 交用戶確認 Phase 1 交付物（等待 Samuel 確認後進入 Phase 2）

## 案件邏輯更新（配合多資格架構）

- [x] cases 表新增 careReceiverId 欄位（FK → customer_care_receivers.id）
- [x] cases.create / cases.update API 支援 careReceiverId
- [x] CaseModal：選擇個人雇主後，從新子表載入被照顧者清單，支援下拉選擇；只有一位時自動預選
- [x] CaseModal：移除舊的 careReceiverName / careReceiverQualification 靜態顯示，改為動態子表資料
- [x] CaseDetail：被照顧者資訊改從 customer_care_receivers 子表讀取（透過 careReceiverId）
- [x] Customers.tsx 搜尋邏輯：移除舊 careReceiverName 等欄位的搜尋（改為搜尋子表）

## CustomerModal 精簡化（v6.0）

- [x] 移除 CustomerModal 的「被照顧者基本資料」section（個人雇主）
- [x] 移除 CustomerModal 的「媒合案件」section
- [x] 移除 CustomerModal 的「申請資格」section
- [x] 移除 CustomerModal 的「聘僱函」section
- [x] 清理 buildPayload 中的被照顧者/案件/資格/聘僱函舊欄位
- [x] 移除未使用的 import（CASE_STATUS_OPTIONS 等）
- [x] TypeScript 零錯誤，30 個 vitest 測試全部通過

## 客戶資格架構重構 v7.0（家庭類 / 事業類）

### Schema 與資料庫
- [x] customer_qualifications 新增 qualifierCategory enum('family','business') 欄位
- [x] cases 新增 customerQualificationId int nullable 欄位（FK → customer_qualifications.id）
- [x] 執行資料庫遷移（ALTER TABLE 兩個）
- [x] 舊資料遷移：customers 主表的資料根據 employerType 自動帶入 qualifierCategory

### 後端 routers.ts
- [x] customers.qualifications.create/update 加入 qualifierCategory
- [x] customers.qualifications.listByCustomer 回傳 qualifierCategory
- [x] cases.create/update 加入 customerQualificationId（選填）

### 前端 CustomerQualifications.tsx 重構
- [x] 依 qualifierCategory 分組顯示（家庭類雇主 / 事業類雇主）
- [x] 新增資格 Modal：第一步選類別（家庭 / 事業）
- [x] 家庭類：顯示被照顧者下拉（從 customer_care_receivers 載入）
- [x] 連結案件：下拉選擇此客戶的現有案件（選填）
- [x] 卡片顯示：類別 badge、被照顧者姓名、連結案件編號

### 前端 CaseModal.tsx 調整
- [x] 選雇主後改為「選擇資格」下拉（客戶有資格時顯示）
- [x] 資格下拉顯示：類別 + 標籤
- [x] 選定資格後自動帶入被照顧者資訊（唯讀顯示）
- [x] 儲存 customerQualificationId 至 cases 表

### 前端 CustomerDetail.tsx 清理
- [x] 移除舊的 caseNo/caseStatus 顯示卡片（右側 rail）
- [x] 確認 CustomerQualifications 元件正確顯示新架構

### 前端 Customers.tsx 清理
- [x] CSV 匙出移除舊 careReceiverName/careReceiverBirthDate/careReceiverQualification 欄位

### 驗收
- [x] TypeScript 零錯誤
- [x] 30 個 vitest 測試全部通過
- [x] 存 checkpoint
