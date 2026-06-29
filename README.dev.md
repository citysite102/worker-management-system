# 本地開發指南

從 Manus 下載的全端專案,在本地開發、之後再同步回 Manus。

## 技術棧
- 前端:React 19 + Vite + Tailwind + tRPC client
- 後端:Express + tRPC + drizzle-orm(**MySQL** / mysql2)
- 認證:Manus OAuth(本地用繞過機制,見下)
- 啟動:`pnpm dev` 一個指令同時跑 server + Vite(單一 port)

## 首次設定

```bash
# 1. 啟用 pnpm
corepack enable && corepack prepare pnpm@10.4.1 --activate

# 2. 安裝套件
pnpm install

# 3. 啟動本地 MySQL(Docker)
docker run -d --name wms-mysql -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=wms mysql:8

# 4. 建立資料表(把 schema.ts 同步到 DB)
pnpm exec drizzle-kit push

# 5. 啟動開發
pnpm dev
```

啟動後看終端機的 `Server running on http://localhost:XXXX/`(port 被占用會自動往上找)。

## 環境變數(`.env`)

`.env` 已被 git 忽略,不會 commit,也不影響 Manus 線上設定。

| 變數 | 說明 |
|---|---|
| `DATABASE_URL` | 本地 MySQL 連線字串 |
| `JWT_SECRET` | session cookie 簽章,本地隨意長字串 |
| `PORT` | 預設 3000,被占用自動跳號 |
| `DEV_AUTH_BYPASS` | `1` = 本地繞過登入(見下) |
| `VITE_APP_ID` / `VITE_OAUTH_PORTAL_URL` / `OAUTH_SERVER_URL` / `OWNER_OPEN_ID` | Manus OAuth,本地用繞過時可留空 |
| `BUILT_IN_FORGE_API_*` / `VITE_FRONTEND_FORGE_API_*` | Manus 內建 LLM / 地圖,用到才需要 |

## 本地登入(繞過機制)

Manus 的 OAuth 設定值平台未開放取得,且不允許 localhost callback,因此本地用繞過:
`server/_core/context.ts` 在 `NODE_ENV !== production` 且 `DEV_AUTH_BYPASS=1` 時,
自動注入一個假 admin 使用者(`openId: dev-local-admin`)。

- 僅開發模式生效,**production 永遠不會生效**,不影響 Manus 線上的真實登入。
- 之後若拿到真正的 OAuth 設定,把 `.env` 的 `DEV_AUTH_BYPASS` 改成 `0` 或刪掉即可。

## 常用指令

```bash
pnpm dev                      # 開發模式
pnpm exec drizzle-kit push    # schema 改了之後重新同步到 DB
pnpm check                    # TypeScript 型別檢查
pnpm test                     # vitest

docker start wms-mysql        # 開機後重啟 DB 容器
docker stop  wms-mysql        # 停止 DB 容器

# 查 / 改 DB
docker exec wms-mysql mysql -uroot -proot wms -e "SELECT * FROM users;"
```

## 同步回 Manus

只有原始碼變更(commit/push)會回到 Manus。`.env`、Docker 資料庫、`node_modules`
都在 `.gitignore` 內,留在本地。Manus 端讀的是它平台自己注入的環境變數,不受本地影響。
