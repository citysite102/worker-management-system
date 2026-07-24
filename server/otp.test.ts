/**
 * checkOtp 純判斷單元測試（手機／信箱驗證流程共用的那份判斷）。
 * 純函式、免任何 mock —— 這正是把重複判斷抽成一份的收穫。
 */
import { describe, it, expect } from "vitest";
import {
  checkOtp,
  hashOtp,
  OTP_MAX_ATTEMPTS,
  type OtpRecordLike,
} from "./_core/auth/otp";

const SALT = "u@example.com";
const CODE = "123456";

function record(over: Partial<OtpRecordLike> = {}): OtpRecordLike {
  return {
    codeHash: hashOtp(CODE, SALT),
    expiresAt: new Date(Date.now() + 5 * 60_000),
    attempts: 0,
    consumedAt: null,
    ...over,
  };
}

describe("checkOtp", () => {
  it("正確碼且有效 → ok", () => {
    expect(checkOtp(record(), CODE, SALT)).toEqual({ ok: true });
  });

  it("無紀錄 → invalid_or_expired", () => {
    expect(checkOtp(undefined, CODE, SALT)).toEqual({
      ok: false,
      reason: "invalid_or_expired",
    });
  });

  it("已消費 → invalid_or_expired", () => {
    expect(checkOtp(record({ consumedAt: new Date() }), CODE, SALT)).toEqual({
      ok: false,
      reason: "invalid_or_expired",
    });
  });

  it("嘗試次數超上限 → invalid_or_expired", () => {
    expect(
      checkOtp(record({ attempts: OTP_MAX_ATTEMPTS }), CODE, SALT)
    ).toEqual({ ok: false, reason: "invalid_or_expired" });
  });

  it("已過期 → invalid_or_expired", () => {
    expect(
      checkOtp(record({ expiresAt: new Date(Date.now() - 1000) }), CODE, SALT)
    ).toEqual({ ok: false, reason: "invalid_or_expired" });
  });

  it("紀錄有效但碼不符 → bad_code（呼叫端應累加 attempts）", () => {
    expect(checkOtp(record(), "000000", SALT)).toEqual({
      ok: false,
      reason: "bad_code",
    });
  });

  it("碼對但 salt 不符（跨對象重放）→ bad_code", () => {
    expect(checkOtp(record(), CODE, "other@example.com")).toEqual({
      ok: false,
      reason: "bad_code",
    });
  });
});
