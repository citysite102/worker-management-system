import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  enabledProviders,
  getProvider,
  buildAuthorizationUrl,
  toIdentity,
  oauthOpenId,
  codeChallengeS256,
} from "./_core/auth/oauthProviders";
import { createAnonymousCaller } from "./__tests__/helpers/caller";

const GOOGLE_ENV = {
  GOOGLE_OAUTH_CLIENT_ID: "gid",
  GOOGLE_OAUTH_CLIENT_SECRET: "gsec",
  GOOGLE_OAUTH_REDIRECT_URI:
    "https://app.example.com/auth/oauth/google/callback",
};

const ALL_KEYS = [
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REDIRECT_URI",
  "LINE_CLIENT_ID",
  "LINE_CLIENT_SECRET",
  "LINE_OAUTH_REDIRECT_URI",
  "FACEBOOK_CLIENT_ID",
  "FACEBOOK_CLIENT_SECRET",
  "FACEBOOK_OAUTH_REDIRECT_URI",
];

describe("oauthProviders（純函式 registry）", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ALL_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ALL_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("未設任何憑證 → 無啟用 provider、getProvider 回 null（inert）", () => {
    expect(enabledProviders()).toEqual([]);
    expect(getProvider("google")).toBeNull();
  });

  it("缺其中一項憑證 → 仍視為未啟用", () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "gid";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "gsec";
    // 少 redirect
    expect(getProvider("google")).toBeNull();
    expect(enabledProviders()).toEqual([]);
  });

  it("設齊 Google 憑證 → 啟用且為 OIDC", () => {
    Object.assign(process.env, GOOGLE_ENV);
    expect(enabledProviders()).toContain("google");
    const cfg = getProvider("google")!;
    expect(cfg.isOIDC).toBe(true);
    expect(cfg.usesPKCE).toBe(true);
    expect(cfg.scopes).toContain("openid");
  });

  it("buildAuthorizationUrl 帶正確參數（scope/state/nonce/PKCE）", () => {
    Object.assign(process.env, GOOGLE_ENV);
    const cfg = getProvider("google")!;
    const url = new URL(
      buildAuthorizationUrl(cfg, {
        state: "st",
        nonce: "no",
        codeChallenge: "cc",
      })
    );
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("gid");
    expect(url.searchParams.get("redirect_uri")).toBe(
      GOOGLE_ENV.GOOGLE_OAUTH_REDIRECT_URI
    );
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("nonce")).toBe("no");
    expect(url.searchParams.get("code_challenge")).toBe("cc");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("身分映射：openId=provider_<sub>，永不以 email 當 key", () => {
    expect(oauthOpenId("line", "U123")).toBe("line_U123");
    expect(toIdentity("google", "abc", "a@b.co", "小明")).toEqual({
      openId: "google_abc",
      email: "a@b.co",
      name: "小明",
      loginMethod: "google",
    });
  });

  it("codeChallengeS256 為 base64url 且對同輸入穩定", () => {
    const a = codeChallengeS256("verifier");
    expect(codeChallengeS256("verifier")).toBe(a);
    expect(a).not.toMatch(/[=+/]/);
  });
});

describe("auth.oauthProviders query", () => {
  it("回傳目前啟用清單（未設 → 空）", async () => {
    const before = process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
    const caller = createAnonymousCaller();
    expect(await caller.auth.oauthProviders()).toEqual([]);
    if (before !== undefined) process.env.GOOGLE_OAUTH_CLIENT_ID = before;
  });
});
