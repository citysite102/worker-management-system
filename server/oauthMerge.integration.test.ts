import { describe, expect, it } from "vitest";
import { resolveOAuthUser } from "./_core/auth/oauthSocial";
import { toIdentity } from "./_core/auth/oauthProviders";
import { createUser } from "./db";
import { query } from "./__tests__/helpers/testDb";

async function identityRowCount(
  provider: string,
  providerUserId: string
): Promise<number> {
  const rows = await query<{ n: number }>(
    "SELECT COUNT(*) AS n FROM `oauth_identities` WHERE provider = ? AND providerUserId = ?",
    [provider, providerUserId]
  );
  return Number(rows[0].n);
}

describe("社群登入帳號合併 resolveOAuthUser（real db）", () => {
  it("email 可信且比對到既有帳號 → 合併到既有帳號，並記錄社群身分", async () => {
    const localOpenId = "local_existing_1";
    await createUser({
      openId: localOpenId,
      email: "merge@test.local",
      name: "既有帳號",
      loginMethod: "email",
      role: "user",
    });

    const gid = toIdentity("google", "gsub-1", "merge@test.local", "Google 名");
    const resolved = await resolveOAuthUser(gid, true);

    // 發 session 用的 openId 是「既有帳號」，不是 google_gsub-1
    expect(resolved.openId).toBe(localOpenId);
    // 未另建 google_ 帳號
    const gUser = await query("SELECT id FROM `users` WHERE openId = ?", [
      "google_gsub-1",
    ]);
    expect(gUser).toHaveLength(0);
    // 社群身分連到既有帳號
    expect(await identityRowCount("google", "gsub-1")).toBe(1);
  });

  it("email 不可信（未驗證）→ 不合併，另建新帳號", async () => {
    await createUser({
      openId: "local_existing_2",
      email: "unverified@test.local",
      name: "既有帳號2",
      loginMethod: "email",
      role: "user",
    });

    const fbid = toIdentity(
      "facebook",
      "fbsub-2",
      "unverified@test.local",
      "FB 名"
    );
    const resolved = await resolveOAuthUser(fbid, false); // 未驗證

    // 應是新帳號 facebook_fbsub-2，而非合併到既有
    expect(resolved.openId).toBe("facebook_fbsub-2");
    const created = await query<{ openId: string }>(
      "SELECT openId FROM `users` WHERE openId = ?",
      ["facebook_fbsub-2"]
    );
    expect(created).toHaveLength(1);
  });

  it("無 email 比對 → 建新帳號並記錄身分", async () => {
    const gid = toIdentity("google", "gsub-3", "brandnew@test.local", "新用戶");
    const resolved = await resolveOAuthUser(gid, true);
    expect(resolved.openId).toBe("google_gsub-3");
    expect(await identityRowCount("google", "gsub-3")).toBe(1);
  });

  it("同一社群身分重複登入 → 命中既有連結，回同一帳號、不重複建身分", async () => {
    const gid = toIdentity("google", "gsub-4", "repeat@test.local", "重複");
    const first = await resolveOAuthUser(gid, true);
    const second = await resolveOAuthUser(gid, true);
    expect(second.openId).toBe(first.openId);
    expect(await identityRowCount("google", "gsub-4")).toBe(1); // 仍只有一筆
  });
});
