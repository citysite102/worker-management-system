# 功能規格：信箱 OTP 驗證（Email/密碼註冊）

> 狀態：**v1.0 已實作（PR #1）** — 六階段走完並通過安全 code review。地基決策見 §3。
> 實作與草稿的差異（§11 待拍板的落地決定）：
>
> - 舊的一步 `auth.register` **已移除**（避免繞過信箱驗證直接建帳號）——原 §11-2 拍板為下線。
> - `users.email` **加唯一索引**，verify 端捕捉重複鍵 → CONFLICT（補強 §7.3 的競態）。
> - `requireEmailVerified` 放行 staff/admin。
> - OTP 效期 10 分鐘、6 碼、重寄冷卻 30 秒（§11-3）。
> - 正式寄信服務商未接：`getEmailSender()` 於正式環境直接丟錯，不靜默回退。

## 1. 目標與背景

公開站的 Email/密碼註冊目前太簡陋：只要 Email 格式對、密碼 8 碼就直接建帳號並登入，**信箱真偽完全沒驗**。這會帶來：

- 假信箱／打錯字的信箱進到系統，之後客服聯繫不到、通知寄不出去。
- 惡意大量註冊（帳號農場）沒有任何門檻。
- schema 已有「email 只在**已驗證**後才拿來合併帳號」的設計（`drizzle/schema.ts` line 1078 附近的 `socialIdentities`），但自助註冊這條路的 email 從來沒被驗證過，與該設計不一致。

**目標**：Email/密碼註冊時，寄一次性驗證碼（OTP）到使用者信箱，輸入正確碼才真正建立帳號。沿用既有 WhatsApp 手機 OTP 的成熟樣板，最小化新增面積。

**非目標（本期不做）**：見 §2。

## 2. 範圍與非目標

**範圍**

- Email/密碼自助註冊加入「寄信箱驗證碼 → 驗碼 → 建帳號」步驟。
- 新增 `emailOtps` 資料表與 `users.emailVerified` 欄位。
- 可抽換的「寄信介面」（本期只實作能讓開發/E2E 跑得動的 stub，不綁定正式寄信服務商）。
- 未驗證帳號的關鍵動作 gating（防呆／相容層）。

**非目標**

- 不做正式寄信服務商（Resend/SendGrid/SMTP）的整合與網域驗證 → 另立票，實作介面時再決定（§3 Q2）。
- 不驗證社群登入（Google/Facebook）的信箱 → 視為已驗證（§3 Q4）。
- 不改動 WhatsApp 手機 OTP 流程，也不把兩者收攏成統一「聯絡方式驗證」（§3 Q4 的第三選項，未採用）。
- 不做「忘記密碼／重設密碼」的信箱流程（雖可共用寄信介面，另立票）。
- 不做重寄冷卻的花俏 UI（僅基本 rate limit）。

## 3. 地基決策（已 grilling 定案）

| #   | 決策             | 選定                              | 影響                                                                                                                          |
| --- | ---------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Q1  | 驗證時機         | **先驗證才建帳號**                | 驗碼成功前不寫 `users` 列 → 沒有殭屍帳號；需要一個地方暫存待建資料（§7 採「驗碼時由前端重送註冊資料」）。                     |
| Q2  | 寄信管道         | **先不綁定，用抽象介面**          | 定義 `EmailSender` 介面；預設 stub（開發/測試印到 log 或記憶體），正式服務商另接。                                            |
| Q3  | 未驗證前能做什麼 | **可登入但擋關鍵動作**            | 需 `users.emailVerified` 旗標與 gating 中介層；因 Q1，新 Email 帳號出生即已驗證，故此層主要保護**既有舊帳號**與未來例外管道。 |
| Q4  | 適用範圍         | **只 Email/密碼；社群視為已驗證** | 社群登入建立/合併帳號時直接 `emailVerified=1`；WhatsApp 帳號不受此驗證要求（見下方相容性）。                                  |

### 3.1 四項決策的交互（重要，避免誤把人擋在門外）

因為 Q1（先驗才建）＋ Q4（只 Email/密碼要驗，社群視為已驗證），**所有新帳號在建立當下都是已驗證**。所以「未驗證但可登入」（Q3）這個狀態只會出現在：

1. **本功能上線前就存在的舊帳號**（含測試種子帳號、既有真實 Email/密碼帳號）。
2. **WhatsApp 手機 OTP 帳號**：以手機建立，`email` 可能為 null。

處理原則：

- **舊 Email/密碼帳號**：migration 時**一律回填 `emailVerified=1`**（grandfather，不追溯要求），避免上線瞬間把現有使用者全鎖住。因此 gating 實務上只對「上線後、以某種例外路徑產生的未驗證帳號」生效，屬防呆層。
- **WhatsApp／無 email 帳號**：gating 只在「帳號的登入方式為 email（`loginMethod === "email"`）」時檢查 `emailVerified`。手機帳號 `loginMethod` 非 email → **不受影響、不被擋**。
- **社群帳號**：建立/合併時即 `emailVerified=1`，天然通過。

## 4. 名詞

- **OTP**：One-Time Password，一次性驗證碼；本功能為寄到信箱的 6 位數字碼。
- **待建註冊（pending registration）**：使用者已送出 Email/密碼/身分但尚未驗碼、還沒真正建立的帳號資料。
- **關鍵動作**：會產生對外效果或業務線索的操作，如「表達媒合意向」「張貼需求單」。瀏覽類（看職缺、看列表）不算。

## 5. 使用者旅程

### 5.1 Happy path（Email/密碼註冊）

1. 使用者在 `/login` 切到「註冊」，選身分（工作者／雇主）、填姓名（選填）、Email、密碼。
2. 按「建立帳號」→ 前端呼叫 `auth.requestEmailOtp({ email })`。
   - 後端：檢查 Email 未被註冊 → 產碼 → 刪同信箱舊碼（單一有效碼）→ 存 HMAC 後的碼＋到期＋歸零嘗試 → 寄信。
3. 畫面切到「輸入驗證碼」步驟（顯示已寄到哪個信箱、可重寄）。
4. 使用者輸入 6 位數碼 → 前端呼叫 `auth.verifyEmailOtpAndRegister({ email, code, password, name, accountType })`。
   - 後端：驗碼（未過期、未消費、嘗試未超限、HMAC 相符）→ **再次**確認 Email 仍未被註冊 → 建立 `users`（`emailVerified=1`）→ 消費該碼 → 發 session → 記稽核 `auth.register`。
5. 自動登入，導回原目的地（沿用現有 `afterAuth` 邏輯）。

### 5.2 邊界與失敗

- **Email 已註冊**（request 階段）：回 `CONFLICT`，不寄碼、不洩漏是否已註冊的細節差異（訊息統一）。
- **碼錯**：`attempts + 1`；超過 `OTP_MAX_ATTEMPTS` → 該碼失效，需重寄。
- **碼過期**（超過 `OTP_TTL_MS`）：驗證失敗，提示重寄。
- **重寄**：呼叫 `requestEmailOtp` 覆蓋舊碼；需 rate limit（§9）。
- **驗碼成功但 Email 在這段時間被別人搶註**（競態）：建立階段的唯一性檢查再擋一次 → 回 `CONFLICT`。
- **寄信失敗**：request 回 `INTERNAL_SERVER_ERROR`（或 `BAD_GATEWAY`），不建立任何帳號；使用者可重試。

## 6. 狀態機

待建註冊（不落 `users`，僅存在 `emailOtps` + 前端記憶體）：

```
[未開始]
   │ requestEmailOtp（Email 未註冊、寄信成功）
   ▼
[已寄碼] ──碼過期/嘗試超限──► [碼失效] ──requestEmailOtp──► [已寄碼]
   │ verifyEmailOtpAndRegister（碼正確且 Email 仍可用）
   ▼
[已建帳號 emailVerified=1] ──issueSession──► [已登入]
```

`users.emailVerified` 狀態（帳號建立後）：

```
0（未驗證）──完成信箱驗證──► 1（已驗證，不可逆）
社群登入建立/合併 → 直接 1
migration 舊 Email/密碼帳號 → 回填 1
```

## 7. 資料模型

### 7.1 新表 `emailOtps`（比照 `phoneOtps`）

```ts
export const emailOtps = mysqlTable(
  "email_otps",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(), // 已 lowercase/trim
    codeHash: varchar("codeHash", { length: 128 }).notNull(), // HMAC-SHA256(code, email)
    expiresAt: timestamp("expiresAt").notNull(),
    attempts: int("attempts").notNull().default(0),
    consumedAt: timestamp("consumedAt"), // null＝未用
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  t => ({ emailIdx: index("email_otps_email_idx").on(t.email) })
);
```

- 沿用 `phoneOtps` 的所有慣例（HMAC 存碼、到期、嘗試、消費、單一有效碼）。
- db 層新增 `createEmailOtp / getLatestEmailOtp / bumpEmailOtpAttempts / consumeEmailOtp / deleteEmailOtps`，可直接參照 `server/db.ts` 的 phone 版。
- `hashOtp / verifyOtpHash / generateOtp / OTP_TTL_MS / OTP_MAX_ATTEMPTS` **共用既有函式**（以 email 當 salt）。

### 7.2 `users` 加欄位

```ts
emailVerified: int("emailVerified").default(0).notNull(), // 0/1，沿用 int 表布林慣例
```

- **Migration 順序**：先加欄位（default 0）→ 立即 backfill：既有 `loginMethod = 'email'` 或非空 email 的帳號設 `emailVerified = 1`（grandfather）→ 再上程式碼。**先 migrate 再上程式碼**（CLAUDE.md 慣例）。

### 7.3 為何不另立 pending registrations 表

Q1「先驗才建」需要在兩步之間保住註冊資料。三個選項：

- **(採用) 前端在 verify 步驟重送 `password/name/accountType`**：`emailOtps` 只綁 email＋碼，不存憑證；密碼走 HTTPS 重送。最小面積、不必存 passwordHash 於暫存表。
- (備案) `emailOtps` 加欄位夾帶 passwordHash/name/accountType：少一次前端重送，但把待建憑證塞進 OTP 表，語義混雜。
- (備案) 獨立 `pendingRegistrations` 表：語義最乾淨但面積最大。

→ 除非 grilling 有反對，**採前端重送**。列入 §11 待確認。

## 8. 寄信抽象介面（Q2）

```ts
// server/_core/email/sender.ts（新）
export interface EmailSender {
  send(
    to: string,
    subject: string,
    body: { text: string; html?: string }
  ): Promise<void>;
}
```

- **預設實作**：`StubEmailSender` — 開發/測試環境把信件內容（含 OTP）印到 log 或存進記憶體佇列，E2E 可讀取。**正式環境未設定寄信服務時，啟動即警示**（比照 `[OAuth] not configured` 的既有做法）。
- 正式服務商（Resend/SendGrid/SMTP）之後各寫一個 `EmailSender` 實作，靠環境變數挑選；不影響上層流程。
- OTP 信件文案需多語（沿用 i18n；越南文/印尼文較長，版面預留）。

## 9. 後端 procedure 設計

> ⚠️ **與 CLAUDE.md「勿新增 public」的關係**：註冊驗證發生在登入前，`requestEmailOtp` 與 `verifyEmailOtpAndRegister` **本質上必須是 `publicProcedure`**（比照既有 `auth.register / auth.login / whatsappRequestOtp / whatsappVerifyOtp` 都是 public）。這是規約允許的「確有必要」例外 → 需 `node scripts/check-conventions.mjs --update` 收緊 baseline，並在 PR 說明理由。

- `auth.requestEmailOtp`（public，mutation）
  - input：`{ email }`（trim/lowercase/email/max 320）
  - 行為：Email 已註冊 → `CONFLICT`；否則產碼、覆蓋舊碼、寄信、回 `{ sent: true }`。
  - rate limit：同信箱每 N 秒最多一封、每小時上限；防列舉與轟炸。
- `auth.verifyEmailOtpAndRegister`（public，mutation）
  - input：`{ email, code(6碼), password(min 8), name?, accountType('worker'|'employer') }`
  - 行為：驗碼 → Email 仍可用 → 建 `users`（`emailVerified=1`）→ 消費碼 → `issueSession` → 稽核 → 回 `{ success, id, accountType }`。
  - **取代**現有 `auth.register` 於前端的呼叫；`auth.register` 是否保留見 §11。
- **Gating 中介層**：關鍵動作的 procedure（如 `expressInterest`、`postDemand` 等）在既有角色中介層上，追加「若 `loginMethod === 'email'` 且 `emailVerified !== 1` → `FORBIDDEN`（訊息：請先完成信箱驗證）」。手機/社群/staff 帳號不觸發。

## 10. 前端變更（`client/src/pages/public/Login.tsx`）

- 註冊模式改為兩步：**填資料 → 輸入驗證碼**（比照現有 WhatsApp `waStage: "idle" | "code"` 的雙階段做法）。
- 新增：驗證碼輸入框、重寄鈕（含冷卻）、「已寄到 x@y」提示、改用信箱、錯誤/過期提示。
- 沿用既有 `afterAuth` 導頁。
- 補 `data-testid`：`register-otp-code`、`register-otp-verify`、`register-otp-resend`、`register-otp-stage` 等（延續本分支已加的 `login-toggle-mode / login-name / register-as-*`）。
- **順帶**：加入「再輸入一次密碼」確認欄位（純前端比對，與 OTP 獨立，可先行合入）。

## 11. 待拍板項（規格定稿前確認）

1. **待建資料保存方式**：採「前端 verify 重送憑證」（§7.3）是否 OK？
2. **`auth.register` 去留**：直接下線舊的無驗證 `register`，或保留給內部/測試？（建議：前端一律走新流程；舊 procedure 標記 deprecated 或加 feature flag。）
3. **OTP 參數**：TTL（沿用 `OTP_TTL_MS` 或信箱另設較長，如 10 分鐘？）、碼長度（6 碼）、每信箱每小時上限。
4. **關鍵動作清單**：確切哪些 procedure 要被 gating（`expressInterest`、`postDemand`、其他？）。
5. **文案與寄件人**：信件主旨/內文、寄件顯示名、預設語言依 `preferredLang`。
6. **測試種子帳號**：`seed-test-accounts.mjs` 是否直接標 `emailVerified=1`（建議是，維持既有 E2E 綠燈）。

## 12. 測試矩陣（第 3 階段先寫、應為紅燈）

**單元（`server/*.test.ts`）**

- `requestEmailOtp`：新信箱 → 產碼＋寄信被呼叫；已註冊信箱 → `CONFLICT`；重寄 → 覆蓋舊碼。
- `verifyEmailOtpAndRegister`：正確碼 → 建帳號（`emailVerified=1`）＋發 session；錯碼 → attempts+1；超限 → 失效；過期 → 失敗；競態（驗碼後信箱被搶）→ `CONFLICT`。
- gating：`loginMethod='email'` 且 `emailVerified=0` 的關鍵動作 → `FORBIDDEN`；手機/社群帳號同動作 → 放行。
- OTP HMAC 以 email 當 salt 的往返（比照本分支 `sessionToken.test.ts` 風格）。

**整合（`*.integration.test.ts`，真 DB）**

- 完整「request → verify → 建帳號 → 關鍵動作放行」；migration backfill 後舊帳號可做關鍵動作。

**前端元件（`vitest.client.config.ts`）**

- Login 兩步驟切換、驗證碼錯誤提示、重寄冷卻、密碼確認不一致擋下。

**E2E（`e2e/*.spec.ts`）**

- 擴充本分支的 `e2e/register.spec.ts`：走完「填資料 → 讀 StubEmailSender 取碼 → 驗碼 → 自動登入」；未驗證帳號（模擬）點關鍵動作被擋。

## 13. 部署順序

1. Migration：加 `email_otps` 表 + `users.emailVerified` 欄位 + backfill 舊帳號為 1。
2. 上後端（新 procedure + gating + StubEmailSender）。
3. 上前端（兩步註冊 + 密碼確認）。
4. `check-conventions --update` 收緊 baseline（記錄兩支必要的新 public）。
5. 正式寄信服務商整合另立票（不阻擋本期上線，Stub 先頂）。

## 14. 未來延伸

- 忘記密碼／重設密碼走同一寄信介面。
- 手機 OTP 與信箱 OTP 收攏成統一「聯絡方式驗證」抽象（Q4 第三選項）。
- 重要通知（媒合進度、法定到期提醒）改走已驗證信箱。
