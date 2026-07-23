# 功能設計：第三方（社群）登入 — Google / Facebook（+ WhatsApp OTP）

狀態：**scaffold + Email 帳號合併已實作**，待你提供憑證後啟用。憑證申請清單見 `docs/overnight-2026-07-23.md`。

> **provider 決定（2026-07-23 更新）**：一鍵 OAuth 登入＝**Google + Facebook**（原 LINE 移除）。
> **WhatsApp 不是 OAuth redirect** 而是「手機號 OTP」流程（見文末「WhatsApp」節），架構不同，需另做且要你先開通 Meta WhatsApp Cloud API + 送審 OTP 訊息範本。

## 目標與原則

- 社群 OAuth 回呼 → 解析/建立**本地 `users` 帳號** → 簽發**本站既有 session cookie**（`app_session_id`）。不引入重型 auth 框架。
- 復用既有 session 簽發 seam：`server/_core/auth/session.ts` 的 `issueSession`（既有 Email/密碼、Manus SSO 都走它）。新 provider 只要產出 `openId` + `name/email` 即可。
- 對外憑證不足（LINE email 未過審、FB email 未過 review）時，**email 設為可選**，仍能登入。

## 現有 auth 快照（研究後事實）

- `users` 單表：`openId`（unique，JWT subject，前綴分流：Manus 原生 / `local_<nanoid>` / `cron_`）、`email`（**非 unique**）、`loginMethod`、`role`(user/staff/admin)、`accountType`(worker/employer/staff/null)、`passwordHash`(scrypt)。
- Session：`jose` HS256 JWT（`JWT_SECRET`），cookie `app_session_id`，1 年。cookie flags 由請求協定決定（HTTPS→SameSite=None+Secure）。
- 既有 Manus 回呼在 `server/_core/oauth.ts`（Express route `GET /api/oauth/callback`）。既有 `state` 只是 `btoa(redirectUri)`，**無 CSRF nonce** — 社群直連必須補真正的 state/PKCE。

## Provider 對照（2026-07 驗證；版本敏感項已標記）

|            | Google                                         | LINE Login v2.1                                | Facebook（Graph v25.0）                                                 |
| ---------- | ---------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| 類型       | OIDC                                           | OIDC                                           | OAuth2（無 id_token）                                                   |
| authorize  | `https://accounts.google.com/o/oauth2/v2/auth` | `https://access.line.me/oauth2/v2.1/authorize` | `https://www.facebook.com/v25.0/dialog/oauth`                           |
| token      | `https://oauth2.googleapis.com/token`          | `https://api.line.me/oauth2/v2.1/token`        | `https://graph.facebook.com/v25.0/oauth/access_token`                   |
| userinfo   | id_token / `.../v1/userinfo`                   | id_token / `/oauth2/v2.1/verify`               | `https://graph.facebook.com/v25.0/me?fields=id,name,email,picture{url}` |
| JWKS       | `https://www.googleapis.com/oauth2/v3/certs`   | `https://api.line.me/oauth2/v2.1/certs`        | —                                                                       |
| scopes     | `openid email profile`                         | `profile openid email`                         | `public_profile email`                                                  |
| 穩定 id    | `sub`                                          | `sub`（LINE userId）                           | `id`（app-scoped）                                                      |
| PKCE       | ✅                                             | ✅                                             | ❌（靠 state + secret）                                                 |
| email 陷阱 | `email_verified` 通常 true                     | **需先審核 email 權限**                        | 可能缺 email；需 App Review                                             |

## 伺服器設計（provider-agnostic）

函式庫：**`arctic`**（Lucia 作者，零依賴，內建 `Google`/`Line`/`Facebook` 類別，處理 authURL/PKCE/token 交換）＋ **`jose`**（既有依賴）做 OIDC id_token 驗簽。

路由（Express，與 tRPC 並存；回呼本質是未登入路由）：

```
GET /auth/oauth/:provider/start      # 產 state(+nonce,+PKCE)、寫短效 cookie、302 至 provider
GET /auth/oauth/:provider/callback   # 驗 state → 換 token → 取身分 → 解析/建立 user → issueSession → 302
```

### /start

1. `state=randomState()`；OIDC 另發 `nonce`；PKCE provider 發 `codeVerifier`。
2. `createAuthorizationURL(state, codeVerifier?, scopes)`。
3. 寫短效 HttpOnly cookie：`oauth_state` / `oauth_nonce` / `oauth_verifier`（`SameSite=Lax; Path=/auth/oauth; Max-Age=600`；Lax 才能在 provider 轉回時帶回）。
4. 302 至 provider。

### /callback

1. 驗 `state === cookie.oauth_state`（常數時間比較），失敗即拒。
2. `validateAuthorizationCode(code, verifier?)` 換 token。
3. 取身分：OIDC 用 `jose` 對 JWKS 驗 id_token（檢 `iss`/`aud`/`exp`/`nonce`），讀 `sub/email/email_verified/name/picture`；FB 打 `/me` 並可用 `debug_token` 確認 `app_id`。
4. 解析/建立 user（見帳號連結）。
5. `issueSession(...)` 簽 `app_session_id`；清 `oauth_*` cookie；302 回站。

### 身分儲存：新表 `oauth_identities`

不以 email 當 key。一個本地 user 可綁多家。

```
oauth_identities(
  id, provider ENUM('google','line','facebook'),
  providerUserId VARCHAR(191),   -- Google/LINE sub、FB app-scoped id
  userId INT -> users.id,
  email, name, pictureUrl, createdAt,
  UNIQUE(provider, providerUserId), INDEX(userId)
)
```

## 帳號連結與 email 信任（安全）

> 註：本節為原始設計脈絡；**實際實作見下方「帳號合併（已實作）」** —— 依你的指示已開啟「可信 email 自動合併」。
> 上方的「Provider 對照」表為 2026-07 研究時的原始三家（含已移除的 LINE），保留作參考。

## 環境變數（§6）

```dotenv
APP_BASE_URL=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=
LINE_CLIENT_ID=            # Channel ID
LINE_CLIENT_SECRET=        # Channel secret
LINE_OAUTH_REDIRECT_URI=
FACEBOOK_CLIENT_ID=        # App ID
FACEBOOK_CLIENT_SECRET=    # App Secret
FACEBOOK_OAUTH_REDIRECT_URI=
FACEBOOK_GRAPH_VERSION=v25.0
```

未設某家 → 該 provider 的按鈕與路由自動隱藏/停用（scaffold 以「憑證存在與否」決定啟用）。

## Scaffold 完成度（本批次）

- [x] `server/_core/auth/oauthProviders.ts`（registry；讀 env，缺憑證即停用；純函式 enabledProviders/buildAuthorizationUrl/toIdentity/PKCE）
- [x] `server/_core/auth/oauthSocial.ts`：`/auth/oauth/:provider/start|callback` 路由 + state/nonce/PKCE cookie，註冊於 `server/_core/index.ts`
- [x] 回呼：換 token（fetch）→ OIDC 用 `jose` 驗 id_token（Google/LINE）/ FB graph profile → `upsertUser` → `issueSession` 復用
- [x] tRPC `auth.oauthProviders`（public）回已啟用清單；前端 `Login.tsx` 依此渲染社群鈕（未設憑證 → 空 → 不顯示）
- [x] 測試：`server/oauthProviders.test.ts`（7，registry/URL/身分/PKCE + query）、`client/.../Login.oauth.test.tsx`（2，按鈕渲染）
- [ ] **待你提供憑證後**：貼進 `.env`（§6 變數）→ 做一次 live 冒煙測試（沙箱無憑證，provider 端 HTTP 交握無法端對端自動測）
- **決策 C（帳號合併）**：目前預設 openId=`provider_<sub>` 各自成帳號、**不以 email 自動合併**（安全）。多 provider 綁同一本地帳號的「設定頁連結」流程為後續（會用到 `oauth_identities` 表）。

### 帳號合併（已實作，2026-07-23 依你的指示開啟）

`oauth_identities` 表 + `resolveOAuthUser(identity, emailVerified)`（`server/_core/auth/oauthSocial.ts`）：

1. 已連結過的 `(provider, providerUserId)` → 直接登入該帳號。
2. 未連結、但 **email 可信**且比對到既有帳號 → **合併**：把此社群身分連到既有帳號，往後同一人用 Google/FB 或 Email 密碼都是同一帳號。
3. 皆無 → 建新帳號並記錄社群身分。

**「email 可信」的判定（安全關鍵）**：只有可信 email 才自動合併，防止有人用未驗證的同名 email 接管既有帳號。

- **Google**：`id_token` 的 `email_verified === true`（一般為 true）→ 合併。
- **Facebook**：Graph 只在使用者有「已確認 email」時回傳 email，故有回 email 即視為可信 → 合併。（此判定在 `identityFromProfile` 一行，可調嚴。）
- 不可信/無 email → 不合併，另建帳號。

測試：`server/oauthMerge.integration.test.ts`（4 real DB：合併、未驗證不合併、無比對建新、重複登入冪等）。

## WhatsApp 登入（＝手機號 OTP，已實作）

**WhatsApp 沒有像 Google/FB 的消費者 OAuth redirect 登入。** 對移工受眾用「手機號 + WhatsApp 收驗證碼」。**已用 Meta Cloud API 實作**（env-gated；未設即隱藏）。

流程：

1. `auth.whatsappRequestOtp({ phone })`：正規化手機號（台灣 09→+886；其他保留國碼）→ 產 6 碼 OTP → 存 `phone_otps`（**只存 HMAC 後的碼**、到期 5 分、嘗試上限 5、單一有效碼）→ 用 Cloud API 發 WhatsApp（authentication 範本）。
2. `auth.whatsappVerifyOtp({ phone, code })`：查最新碼（未過期/未用/未超嘗試）→ 常數時間比對 → 成功即 `resolveWhatsappUser`（以 `users.phone` resolve/建立，`phoneVerified=1`、`loginMethod=whatsapp`）→ `issueSession`。錯碼累加 attempts。
3. 前端 `Login.tsx`：`whatsappEnabled` 為真才顯示「手機 → 收碼 → 驗證」小流程。

**檔案**：`server/_core/auth/whatsapp.ts`（config/OTP/HMAC/normalize/sendOtp/resolve）、`auth.whatsappEnabled|whatsappRequestOtp|whatsappVerifyOtp`（routers）、`phone_otps` 表。
**測試**：`server/whatsapp.test.ts`（5 純函式 + enabled query）、`server/whatsappOtp.integration.test.ts`（4 real DB：request→verify、錯碼累計、重放防護、台灣格式）——發送端（Cloud API）在測試中被 stub。

**你需準備（長前置）**：WhatsApp Business + Cloud API（Access Token + Phone Number ID）+ **送審 authentication OTP 範本**。設進 `.env` 後做一次 live 冒煙（真的收到 WhatsApp 碼）。env 變數：

```dotenv
WHATSAPP_CLOUD_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_OTP_TEMPLATE=      # 已核准的範本名，如 otp_login
WHATSAPP_OTP_LANG=en        # 範本語言碼（選填，預設 en）
# 共用 FACEBOOK_GRAPH_VERSION（預設 v25.0）
```

**待強化（非阻斷）**：發碼頻率限制（防簡訊轟炸）；國際手機號的前端國碼選擇器；範本語言依使用者語系切換。

## 版本敏感備註

- Facebook Graph 版本會約每季更新，用 `FACEBOOK_GRAPH_VERSION` pin（現 v25.0）。
- LINE email 權限需先送審才會回傳 email。
- 來源：Google/LINE/Facebook 官方文件（見研究報告）。
