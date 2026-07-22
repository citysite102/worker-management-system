# 功能設計：第三方（社群）登入 — Google / LINE / Facebook

狀態：**scaffold（程式與設定就緒）**，待你提供各家憑證後啟用。憑證申請清單見 `docs/overnight-2026-07-23.md`。

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

回呼查找順序：

1. `(provider, providerUserId)` 命中 → 直接登入該 user（永遠安全）。
2. 未命中但有 email：
   - **不因 provider email 相同就自動合併**（防 pre-account-takeover）。
   - Google `email_verified===true` 可視為較安全；LINE/FB 不保證 → 一律要求「先登入本地帳號，再於設定頁連結」。
   - 無 email（LINE/FB 未過審常見）→ 建新帳號、之後再補 email。
3. 皆未命中 → 建立新 `users`（`loginMethod=provider`、`openId=<provider>_<providerUserId>`、`accountType` 先 null，登入後引導選 worker/employer）。

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

- [ ] `oauth_identities` 表 + migration
- [ ] `server/_core/auth/oauthProviders.ts`（registry；讀 env，缺憑證即停用）
- [ ] `/auth/oauth/:provider/start|callback` 路由 + state/PKCE/nonce cookie
- [ ] 回呼解析 → `issueSession` 復用
- [ ] 前端：`Login.tsx` 依「已啟用 provider」渲染按鈕
- [ ] 單元測試（state 驗證、身分解析、帳號連結分支）；回呼 e2e 待有沙箱憑證再補

## 版本敏感備註

- Facebook Graph 版本會約每季更新，用 `FACEBOOK_GRAPH_VERSION` pin（現 v25.0）。
- LINE email 權限需先送審才會回傳 email。
- 來源：Google/LINE/Facebook 官方文件（見研究報告）。
