import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  normalizePhone,
  hashOtp,
  verifyOtpHash,
  generateOtp,
  whatsappEnabled,
} from "./_core/auth/whatsapp";
import { createAnonymousCaller } from "./__tests__/helpers/caller";

describe("whatsapp 純函式", () => {
  it("normalizePhone：台灣本地 / 國際 / 含 +（去空白與符號）", () => {
    expect(normalizePhone("0912345678")).toBe("+886912345678");
    expect(normalizePhone("+886912345678")).toBe("+886912345678");
    expect(normalizePhone("886912345678")).toBe("+886912345678");
    expect(normalizePhone("+62 812-3456-789")).toBe("+628123456789");
  });

  it("normalizePhone：太短/太長丟錯", () => {
    expect(() => normalizePhone("123")).toThrow();
    expect(() => normalizePhone("+1234567890123456789")).toThrow();
  });

  it("generateOtp：一律 6 位數字", () => {
    for (let i = 0; i < 30; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it("hashOtp/verifyOtpHash：正確碼過、錯碼不過、跨手機號不過", () => {
    const phone = "+886912345678";
    const h = hashOtp("123456", phone);
    expect(verifyOtpHash("123456", phone, h)).toBe(true);
    expect(verifyOtpHash("000000", phone, h)).toBe(false);
    expect(verifyOtpHash("123456", "+886900000000", h)).toBe(false); // 換手機號即不符
  });
});

describe("auth.whatsappEnabled query", () => {
  const keys = [
    "WHATSAPP_CLOUD_API_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_OTP_TEMPLATE",
  ];
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("未設 Cloud API → false", async () => {
    const caller = createAnonymousCaller();
    expect(await caller.auth.whatsappEnabled()).toBe(false);
    expect(whatsappEnabled()).toBe(false);
  });
});
