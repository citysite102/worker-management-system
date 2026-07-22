// ─── 社群 OAuth provider registry（Google / LINE / Facebook）──────────────────
// 純設定 + 純函式：以環境變數決定「哪幾家已啟用」，並產生授權 URL 與身分映射。
// 實際 token 交換 / id_token 驗簽 / profile 抓取在 oauthSocial.ts。缺憑證的 provider
// 一律視為未啟用（enabledProviders 不含它，路由回 404），保證未設定時完全 inert。
// 設計文件：docs/feature-oauth-social-login.md
import { createHash, randomBytes } from "node:crypto";

export type ProviderId = "google" | "line" | "facebook";
export const PROVIDER_IDS: ProviderId[] = ["google", "line", "facebook"];

export interface ProviderConfig {
  id: ProviderId;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  usesPKCE: boolean;
  isOIDC: boolean;
  jwksUrl?: string;
  issuer?: string;
  /** 非 OIDC（Facebook）用的 profile endpoint。 */
  profileUrl?: string;
}

/** 各 provider 的固定端點與 scope（憑證從 env 帶入）。 */
const STATIC: Record<
  ProviderId,
  Omit<ProviderConfig, "clientId" | "clientSecret" | "redirectUri" | "id">
> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["openid", "email", "profile"],
    usesPKCE: true,
    isOIDC: true,
    jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
    issuer: "https://accounts.google.com",
  },
  line: {
    authorizeUrl: "https://access.line.me/oauth2/v2.1/authorize",
    tokenUrl: "https://api.line.me/oauth2/v2.1/token",
    scopes: ["openid", "profile", "email"],
    usesPKCE: true,
    isOIDC: true,
    jwksUrl: "https://api.line.me/oauth2/v2.1/certs",
    issuer: "https://access.line.me",
  },
  facebook: {
    authorizeUrl: `https://www.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION ?? "v25.0"}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION ?? "v25.0"}/oauth/access_token`,
    scopes: ["public_profile", "email"],
    usesPKCE: false,
    isOIDC: false,
    profileUrl: `https://graph.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION ?? "v25.0"}/me?fields=id,name,email,picture{url}`,
  },
};

/** env 變數名（每家：CLIENT_ID / CLIENT_SECRET / REDIRECT_URI）。 */
const ENV_KEYS: Record<
  ProviderId,
  { id: string; secret: string; redirect: string }
> = {
  google: {
    id: "GOOGLE_OAUTH_CLIENT_ID",
    secret: "GOOGLE_OAUTH_CLIENT_SECRET",
    redirect: "GOOGLE_OAUTH_REDIRECT_URI",
  },
  line: {
    id: "LINE_CLIENT_ID",
    secret: "LINE_CLIENT_SECRET",
    redirect: "LINE_OAUTH_REDIRECT_URI",
  },
  facebook: {
    id: "FACEBOOK_CLIENT_ID",
    secret: "FACEBOOK_CLIENT_SECRET",
    redirect: "FACEBOOK_OAUTH_REDIRECT_URI",
  },
};

/** 讀取單一 provider 的完整設定；缺任何一項憑證即回 null（＝未啟用）。 */
export function getProvider(id: ProviderId): ProviderConfig | null {
  const keys = ENV_KEYS[id];
  const clientId = process.env[keys.id];
  const clientSecret = process.env[keys.secret];
  const redirectUri = process.env[keys.redirect];
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { id, clientId, clientSecret, redirectUri, ...STATIC[id] };
}

/** 目前已設定憑證、可用的 provider 清單（供前端決定顯示哪些登入鈕）。 */
export function enabledProviders(): ProviderId[] {
  return PROVIDER_IDS.filter(id => getProvider(id) !== null);
}

/** provider + provider 端使用者 id → 本地 openId（前綴分流，與 local_/cron_ 一致）。 */
export function oauthOpenId(
  provider: ProviderId,
  providerUserId: string
): string {
  return `${provider}_${providerUserId}`;
}

// ── PKCE / state / nonce（用 node crypto，不引外部依賴）───────────────────────
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
export function codeChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** 依設定產生授權 URL（含 scope/state，OIDC 帶 nonce，PKCE 帶 code_challenge）。 */
export function buildAuthorizationUrl(
  cfg: ProviderConfig,
  opts: { state: string; nonce?: string; codeChallenge?: string }
): string {
  const u = new URL(cfg.authorizeUrl);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("redirect_uri", cfg.redirectUri);
  u.searchParams.set("scope", cfg.scopes.join(" "));
  u.searchParams.set("state", opts.state);
  if (cfg.isOIDC && opts.nonce) u.searchParams.set("nonce", opts.nonce);
  if (cfg.usesPKCE && opts.codeChallenge) {
    u.searchParams.set("code_challenge", opts.codeChallenge);
    u.searchParams.set("code_challenge_method", "S256");
  }
  return u.toString();
}

/** 標準化的社群身分（供 issueSession / upsertUser）。 */
export interface OAuthIdentity {
  openId: string;
  email: string | null;
  name: string | null;
  loginMethod: ProviderId;
}

/** 把 provider 端使用者資料映射成本地身分（openId=provider_<providerUserId>）。 */
export function toIdentity(
  provider: ProviderId,
  providerUserId: string,
  email: string | null,
  name: string | null
): OAuthIdentity {
  return {
    openId: oauthOpenId(provider, providerUserId),
    email: email ?? null,
    name: name ?? null,
    loginMethod: provider,
  };
}
