/**
 * emailRegister 深模組單元測試 —— 直接呼叫模組函式，不經 tRPC caller。
 * 這正是候選 A 深化的收穫：驗碼＋建帳號的編排從路由抽出來後，能像純函式一樣直接測，
 * 只需 mock db 與 password，不必 createCaller ＋ 一大坨 mock。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  getUserByEmail: vi.fn().mockResolvedValue(undefined),
  getLatestEmailOtp: vi.fn().mockResolvedValue(undefined),
  createEmailOtp: vi.fn().mockResolvedValue(801),
  deleteEmailOtps: vi.fn().mockResolvedValue(undefined),
  bumpEmailOtpAttempts: vi.fn().mockResolvedValue(undefined),
  consumeEmailOtp: vi.fn().mockResolvedValue(undefined),
  createUser: vi.fn().mockResolvedValue(501),
}));
vi.mock("./db", () => db);
vi.mock("./_core/auth/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("scrypt$salt$hash"),
  verifyPassword: vi.fn(),
}));

import {
  requestEmailRegistrationOtp,
  verifyEmailOtpAndCreateUser,
} from "./_core/auth/emailRegister";
import { hashOtp } from "./_core/auth/otp";

function otpRow(email: string, code: string, over = {}) {
  return {
    id: 42,
    email,
    codeHash: hashOtp(code, email),
    expiresAt: new Date(Date.now() + 5 * 60_000),
    attempts: 0,
    consumedAt: null,
    createdAt: new Date(Date.now() - 1000),
    ...over,
  };
}

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockClear();
  db.getUserByEmail.mockResolvedValue(undefined);
  db.getLatestEmailOtp.mockResolvedValue(undefined);
  db.createUser.mockResolvedValue(501);
});

describe("requestEmailRegistrationOtp", () => {
  it("新 Email → 刪舊碼、建新碼、回 { sent: true }", async () => {
    const r = await requestEmailRegistrationOtp("new@example.com");
    expect(r).toEqual({ sent: true });
    expect(db.deleteEmailOtps).toHaveBeenCalledWith("new@example.com");
    expect(db.createEmailOtp.mock.calls[0][0]).toMatchObject({
      email: "new@example.com",
    });
  });

  it("Email 已註冊 → CONFLICT，不建碼", async () => {
    db.getUserByEmail.mockResolvedValueOnce({ id: 9 });
    await expect(
      requestEmailRegistrationOtp("dup@example.com")
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.createEmailOtp).not.toHaveBeenCalled();
  });
});

describe("verifyEmailOtpAndCreateUser", () => {
  const base = {
    email: "u@example.com",
    code: "123456",
    password: "pw12345678",
    accountType: "employer" as const,
    name: "小明",
  };

  it("無有效碼 → UNAUTHORIZED，不建帳號", async () => {
    db.getLatestEmailOtp.mockResolvedValueOnce(undefined);
    await expect(verifyEmailOtpAndCreateUser(base)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(db.createUser).not.toHaveBeenCalled();
  });

  it("碼不符 → 累加 attempts 且 UNAUTHORIZED，不建帳號", async () => {
    db.getLatestEmailOtp.mockResolvedValueOnce(
      otpRow("u@example.com", "999999")
    );
    await expect(verifyEmailOtpAndCreateUser(base)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(db.bumpEmailOtpAttempts).toHaveBeenCalledWith(42);
    expect(db.createUser).not.toHaveBeenCalled();
  });

  it("碼正確 → 建帳號、消費碼、回新帳號資訊", async () => {
    db.getLatestEmailOtp.mockResolvedValueOnce(
      otpRow("u@example.com", "123456")
    );
    const user = await verifyEmailOtpAndCreateUser(base);
    expect(user).toMatchObject({
      id: 501,
      accountType: "employer",
      name: "小明",
    });
    expect(db.createUser.mock.calls[0][0]).toMatchObject({
      email: "u@example.com",
      loginMethod: "email",
      emailVerified: 1,
    });
    expect(db.consumeEmailOtp).toHaveBeenCalledWith(42);
  });

  it("並行競態：createUser 撞唯一鍵 ER_DUP_ENTRY → CONFLICT", async () => {
    db.getLatestEmailOtp.mockResolvedValueOnce(
      otpRow("u@example.com", "123456")
    );
    db.createUser.mockRejectedValueOnce(
      Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" })
    );
    await expect(verifyEmailOtpAndCreateUser(base)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.consumeEmailOtp).toHaveBeenCalledWith(42);
  });
});
