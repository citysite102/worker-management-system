/**
 * 信箱 OTP 註冊整合測試（real db）。
 *
 * 「先驗證才建帳號」：requestEmailOtp 只寄碼、不建 users；
 * verifyEmailOtpAndRegister 驗碼成功才建帳號（emailVerified=1）並發 session。
 *
 * 用 E2E_FIXED_OTP 固定驗證碼（非正式環境；見 auth/emailOtp.ts 的 devFixedOtp），
 * 免去真的寄信；帳號/資料由 setup.integration.ts 每個 test 前 resetDb。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createAnonymousCaller } from "./__tests__/helpers/caller";
import { query } from "./__tests__/helpers/testDb";

const FIXED = "654321";
let saved: string | undefined;
beforeAll(() => {
  saved = process.env.E2E_FIXED_OTP;
  process.env.E2E_FIXED_OTP = FIXED;
});
afterAll(() => {
  if (saved === undefined) delete process.env.E2E_FIXED_OTP;
  else process.env.E2E_FIXED_OTP = saved;
});

describe("信箱 OTP 註冊（real db）", () => {
  it("request → verify 成功：建立帳號、emailVerified=1、loginMethod=email、碼被消費", async () => {
    const caller = createAnonymousCaller();
    const email = "otp-ok@test.local";
    expect(await caller.auth.requestEmailOtp({ email })).toEqual({
      sent: true,
    });
    const otps = await query("SELECT id FROM `email_otps` WHERE email = ?", [
      email,
    ]);
    expect(otps).toHaveLength(1);

    const r = await caller.auth.verifyEmailOtpAndRegister({
      email,
      code: FIXED,
      password: "pw12345678",
      accountType: "employer",
      name: "OTP 用戶",
    });
    expect(r).toMatchObject({ success: true, accountType: "employer" });

    const users = await query<{
      emailVerified: number;
      loginMethod: string;
      accountType: string;
    }>(
      "SELECT emailVerified, loginMethod, accountType FROM `users` WHERE email = ?",
      [email]
    );
    expect(users).toHaveLength(1);
    expect(users[0].emailVerified).toBe(1);
    expect(users[0].loginMethod).toBe("email");
    expect(users[0].accountType).toBe("employer");

    const consumed = await query<{ consumedAt: string | null }>(
      "SELECT consumedAt FROM `email_otps` WHERE email = ?",
      [email]
    );
    expect(consumed[0].consumedAt).not.toBeNull();
  });

  it("已註冊 Email → requestEmailOtp 直接 CONFLICT", async () => {
    const caller = createAnonymousCaller();
    const email = "otp-dup@test.local";
    await caller.auth.requestEmailOtp({ email });
    await caller.auth.verifyEmailOtpAndRegister({
      email,
      code: FIXED,
      password: "pw12345678",
      accountType: "worker",
    });
    await expect(caller.auth.requestEmailOtp({ email })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("錯誤碼 → UNAUTHORIZED、累加 attempts、且不建立帳號", async () => {
    const caller = createAnonymousCaller();
    const email = "otp-wrong@test.local";
    await caller.auth.requestEmailOtp({ email });
    await expect(
      caller.auth.verifyEmailOtpAndRegister({
        email,
        code: "000000",
        password: "pw12345678",
        accountType: "worker",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const rows = await query<{ attempts: number }>(
      "SELECT attempts FROM `email_otps` WHERE email = ? ORDER BY id DESC LIMIT 1",
      [email]
    );
    expect(rows[0].attempts).toBe(1);
    const u = await query("SELECT id FROM `users` WHERE email = ?", [email]);
    expect(u).toHaveLength(0);
  });

  it("沒先 request 就 verify → UNAUTHORIZED（無有效碼）", async () => {
    const caller = createAnonymousCaller();
    await expect(
      caller.auth.verifyEmailOtpAndRegister({
        email: "otp-none@test.local",
        code: FIXED,
        password: "pw12345678",
        accountType: "worker",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("碼用過不可重放（第二次 verify → UNAUTHORIZED，帳號只建立一次）", async () => {
    const caller = createAnonymousCaller();
    const email = "otp-replay@test.local";
    await caller.auth.requestEmailOtp({ email });
    await caller.auth.verifyEmailOtpAndRegister({
      email,
      code: FIXED,
      password: "pw12345678",
      accountType: "worker",
    });
    await expect(
      caller.auth.verifyEmailOtpAndRegister({
        email,
        code: FIXED,
        password: "pw12345678",
        accountType: "worker",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const u = await query("SELECT id FROM `users` WHERE email = ?", [email]);
    expect(u).toHaveLength(1);
  });
});
