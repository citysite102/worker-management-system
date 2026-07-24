/**
 * Session token 簽發／驗證的往返測試。
 *
 * 迴歸守衛：Email/密碼註冊時「姓名為選填」，因此可能發出 name 為空字串的
 * session。verifySession 過去把 name 當必要非空欄位，導致「沒填姓名就註冊」的
 * 帳號一發 session 就驗不過、立刻被當成未登入。name 只是顯示用，openId／appId
 * 才是安全相關欄位——空姓名的 session 必須仍能驗過。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

// 單元測試環境未設 JWT_SECRET/appId；簽發與驗證共用同一組值即可測往返。
let prevSecret: string;
let prevAppId: string;
beforeAll(() => {
  prevSecret = ENV.cookieSecret;
  prevAppId = ENV.appId;
  ENV.cookieSecret = "test-secret-for-session-roundtrip";
  ENV.appId = "test-app-id";
});
afterAll(() => {
  ENV.cookieSecret = prevSecret;
  ENV.appId = prevAppId;
});

describe("session token 往返（姓名為空也要能驗過）", () => {
  it("無姓名（name 空字串）發出的 session 仍驗證通過，openId 保留", async () => {
    const token = await sdk.createSessionToken("local_no_name", { name: "" });
    const session = await sdk.verifySession(token);
    expect(session).not.toBeNull();
    expect(session?.openId).toBe("local_no_name");
    expect(session?.name).toBe("");
  });

  it("有姓名時，name claim 原樣保留", async () => {
    const token = await sdk.createSessionToken("local_named", { name: "小明" });
    const session = await sdk.verifySession(token);
    expect(session?.openId).toBe("local_named");
    expect(session?.name).toBe("小明");
  });

  it("openId 為空的偽造 payload 仍被拒（安全欄位維持必要）", async () => {
    const token = await sdk.signSession({ openId: "", appId: "x", name: "n" });
    expect(await sdk.verifySession(token)).toBeNull();
  });

  it("空 / 無效 cookie 一律拒絕", async () => {
    expect(await sdk.verifySession(undefined)).toBeNull();
    expect(await sdk.verifySession("")).toBeNull();
    expect(await sdk.verifySession("not-a-jwt")).toBeNull();
  });
});
