import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./_core/auth/password";

describe("password hashing (scrypt)", () => {
  it("雜湊格式為 scrypt$salt$hash", async () => {
    const h = await hashPassword("s3cret-pw");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(h.split("$")).toHaveLength(3);
  });

  it("同一密碼每次 salt 不同（雜湊不相等）", async () => {
    const a = await hashPassword("same-pw");
    const b = await hashPassword("same-pw");
    expect(a).not.toBe(b);
  });

  it("正確密碼驗證通過", async () => {
    const h = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
  });

  it("錯誤密碼驗證失敗", async () => {
    const h = await hashPassword("correct horse battery");
    expect(await verifyPassword("wrong", h)).toBe(false);
  });

  it("空/格式不符的雜湊一律 false", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$a$b")).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});
