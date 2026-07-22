// ─── 社群 OAuth 回呼路由（Google / LINE / Facebook）──────────────────────────
// GET /auth/oauth/:provider/start     產 state(+nonce,+PKCE)、寫短效 cookie、302 至 provider
// GET /auth/oauth/:provider/callback  驗 state → 換 token → 取身分 → upsertUser → issueSession → 302
//
// 未設定憑證的 provider → getProvider 回 null → 路由 404（完全 inter）。
// 這支的「與 provider 的實際 HTTP 交握」需在有真實憑證後做一次 live 冒煙測試
// （沙箱無憑證，無法端對端自動測；純函式部分見 oauthProviders.test.ts）。
import type { Express, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  getProvider,
  buildAuthorizationUrl,
  toIdentity,
  randomToken,
  codeChallengeS256,
  type ProviderConfig,
  type ProviderId,
  type OAuthIdentity,
} from "./oauthProviders";
import { issueSession } from "./session";
import { upsertUser } from "../../db";

const STATE_COOKIE = "oauth_state";
const NONCE_COOKIE = "oauth_nonce";
const VERIFIER_COOKIE = "oauth_verifier";

/** 短效交握 cookie 選項：SameSite=Lax 才能在 provider 轉回時帶回。 */
function handshakeCookie(req: Request) {
  return {
    httpOnly: true,
    secure: req.protocol === "https",
    sameSite: "lax" as const,
    path: "/auth/oauth",
    maxAge: 600_000, // 10 分鐘
  };
}

/** 從 Cookie header 取單一 cookie（不依賴 cookie-parser）。 */
function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

function clearHandshakeCookies(res: Response) {
  for (const name of [STATE_COOKIE, NONCE_COOKIE, VERIFIER_COOKIE]) {
    res.clearCookie(name, { path: "/auth/oauth" });
  }
}

export function registerSocialOAuthRoutes(app: Express): void {
  app.get("/auth/oauth/:provider/start", (req, res) => {
    const cfg = getProvider(req.params.provider as ProviderId);
    if (!cfg) {
      res.status(404).send("provider not enabled");
      return;
    }
    const state = randomToken();
    const opts = handshakeCookie(req);
    res.cookie(STATE_COOKIE, state, opts);

    let nonce: string | undefined;
    let codeChallenge: string | undefined;
    if (cfg.isOIDC) {
      nonce = randomToken();
      res.cookie(NONCE_COOKIE, nonce, opts);
    }
    if (cfg.usesPKCE) {
      const verifier = randomToken();
      res.cookie(VERIFIER_COOKIE, verifier, opts);
      codeChallenge = codeChallengeS256(verifier);
    }
    res.redirect(
      302,
      buildAuthorizationUrl(cfg, { state, nonce, codeChallenge })
    );
  });

  app.get("/auth/oauth/:provider/callback", async (req, res) => {
    const cfg = getProvider(req.params.provider as ProviderId);
    if (!cfg) {
      res.status(404).send("provider not enabled");
      return;
    }
    try {
      const code = String(req.query.code ?? "");
      const state = String(req.query.state ?? "");
      const cookieState = readCookie(req, STATE_COOKIE);
      // CSRF：state 必須與 cookie 相符
      if (!code || !state || !cookieState || state !== cookieState) {
        throw new Error("invalid oauth state");
      }
      const tokens = await exchangeCode(
        cfg,
        code,
        readCookie(req, VERIFIER_COOKIE)
      );
      const identity = cfg.isOIDC
        ? await identityFromOidc(cfg, tokens, readCookie(req, NONCE_COOKIE))
        : await identityFromProfile(cfg, tokens.access_token);

      // 預設「不以 email 自動合併」：openId=provider_<sub> 即各自成帳號（安全預設）。
      await upsertUser({
        openId: identity.openId,
        name: identity.name,
        email: identity.email,
        loginMethod: identity.loginMethod,
        lastSignedIn: new Date(),
      });
      await issueSession(req, res, {
        openId: identity.openId,
        name: identity.name,
      });
      clearHandshakeCookies(res);
      res.redirect(302, "/");
    } catch (err) {
      console.error("[oauth-social] callback failed:", err);
      clearHandshakeCookies(res);
      res.redirect(302, "/login?oauth_error=1");
    }
  });
}

interface TokenResponse {
  access_token: string;
  id_token?: string;
  token_type?: string;
}

/** Authorization Code → tokens（form-encoded POST；PKCE 帶 code_verifier）。 */
async function exchangeCode(
  cfg: ProviderConfig,
  code: string,
  verifier: string | undefined
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  if (cfg.usesPKCE && verifier) body.set("code_verifier", verifier);
  const resp = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) {
    throw new Error(
      `token exchange failed: ${resp.status} ${await resp.text()}`
    );
  }
  return (await resp.json()) as TokenResponse;
}

/** OIDC：驗 id_token 簽章（JWKS）與 iss/aud/nonce，取 sub/email/name。 */
async function identityFromOidc(
  cfg: ProviderConfig,
  tokens: TokenResponse,
  expectedNonce: string | undefined
): Promise<OAuthIdentity> {
  if (!tokens.id_token) throw new Error("missing id_token");
  const jwks = createRemoteJWKSet(new URL(cfg.jwksUrl!));
  const { payload } = await jwtVerify(tokens.id_token, jwks, {
    issuer: cfg.issuer,
    audience: cfg.clientId,
  });
  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error("nonce mismatch");
  }
  const sub = String(payload.sub ?? "");
  if (!sub) throw new Error("missing sub");
  const email =
    typeof payload.email === "string" && payload.email ? payload.email : null;
  const name =
    typeof payload.name === "string" && payload.name ? payload.name : null;
  return toIdentity(cfg.id, sub, email, name);
}

/** 非 OIDC（Facebook）：以 access_token 打 profile endpoint。 */
async function identityFromProfile(
  cfg: ProviderConfig,
  accessToken: string
): Promise<OAuthIdentity> {
  const resp = await fetch(cfg.profileUrl!, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error(`profile fetch failed: ${resp.status}`);
  const p = (await resp.json()) as {
    id?: string;
    name?: string;
    email?: string;
  };
  if (!p.id) throw new Error("missing profile id");
  return toIdentity(cfg.id, p.id, p.email ?? null, p.name ?? null);
}
