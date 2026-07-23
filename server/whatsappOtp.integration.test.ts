import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// 固定 OTP 並停用真實 Cloud API 發送；其餘（whatsappEnabled/normalize/resolve）保持真實。
vi.mock("./_core/auth/whatsapp", async importActual => {
  const actual = await importActual<typeof import("./_core/auth/whatsapp")>();
  return { ...actual, generateOtp: () => "654321", sendOtp: async () => {} };
});

import { createAnonymousCaller } from "./__tests__/helpers/caller";
import { query } from "./__tests__/helpers/testDb";

const WA_ENV = {
  WHATSAPP_CLOUD_API_TOKEN: "tkn",
  WHATSAPP_PHONE_NUMBER_ID: "pnid",
  WHATSAPP_OTP_TEMPLATE: "otp_login",
};
const saved: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const [k, v] of Object.entries(WA_ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
});
afterAll(() => {
  for (const k of Object.keys(WA_ENV)) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const PHONE = "+886912345678";

describe("WhatsApp OTP 登入（real db）", () => {
  it("request → verify 成功：建立手機帳號、phoneVerified=1、loginMethod=whatsapp", async () => {
    const caller = createAnonymousCaller();
    expect(await caller.auth.whatsappRequestOtp({ phone: PHONE })).toEqual({
      sent: true,
    });
    const otps = await query("SELECT id FROM `phone_otps` WHERE phone = ?", [
      PHONE,
    ]);
    expect(otps).toHaveLength(1);

    expect(
      await caller.auth.whatsappVerifyOtp({ phone: PHONE, code: "654321" })
    ).toEqual({ ok: true });

    const users = await query<{ phoneVerified: number; loginMethod: string }>(
      "SELECT phoneVerified, loginMethod FROM `users` WHERE phone = ?",
      [PHONE]
    );
    expect(users).toHaveLength(1);
    expect(users[0].phoneVerified).toBe(1);
    expect(users[0].loginMethod).toBe("whatsapp");
  });

  it("錯誤碼 → UNAUTHORIZED 且累加 attempts", async () => {
    const caller = createAnonymousCaller();
    await caller.auth.whatsappRequestOtp({ phone: PHONE });
    await expect(
      caller.auth.whatsappVerifyOtp({ phone: PHONE, code: "000000" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const rows = await query<{ attempts: number }>(
      "SELECT attempts FROM `phone_otps` WHERE phone = ? ORDER BY id DESC LIMIT 1",
      [PHONE]
    );
    expect(rows[0].attempts).toBe(1);
  });

  it("已用的碼不可重放（第二次 verify 失敗）", async () => {
    const caller = createAnonymousCaller();
    await caller.auth.whatsappRequestOtp({ phone: PHONE });
    await caller.auth.whatsappVerifyOtp({ phone: PHONE, code: "654321" });
    await expect(
      caller.auth.whatsappVerifyOtp({ phone: PHONE, code: "654321" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("台灣本地格式 0912… 正規化後也能登入", async () => {
    const caller = createAnonymousCaller();
    await caller.auth.whatsappRequestOtp({ phone: "0912345678" });
    expect(
      await caller.auth.whatsappVerifyOtp({
        phone: "0912345678",
        code: "654321",
      })
    ).toEqual({ ok: true });
    const users = await query("SELECT id FROM `users` WHERE phone = ?", [
      "+886912345678",
    ]);
    expect(users).toHaveLength(1);
  });
});
