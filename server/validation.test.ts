import { describe, expect, it } from "vitest";
import {
  validateTwPhone,
  normalizePhone,
  validateResidentPermit,
  validatePassport,
  validateTaxId,
  validateNotFutureDate,
} from "../shared/validation";

describe("validateTwPhone", () => {
  it("accepts valid mobile number", () => {
    expect(validateTwPhone("0912345678")).toBe(true);
  });
  it("accepts mobile with dashes", () => {
    expect(validateTwPhone("0912-345-678")).toBe(true);
  });
  it("accepts landline", () => {
    expect(validateTwPhone("0223456789")).toBe(true);
  });
  it("rejects invalid phone", () => {
    expect(validateTwPhone("1234567890")).toBe(false);
    expect(validateTwPhone("091234567")).toBe(false);
    expect(validateTwPhone("abc")).toBe(false);
  });
});

describe("normalizePhone", () => {
  it("removes dashes", () => {
    expect(normalizePhone("0912-345-678")).toBe("0912345678");
  });
});

describe("validateResidentPermit", () => {
  it("accepts valid resident permit", () => {
    expect(validateResidentPermit("A123456789")).toBe(true);  // 舊式：字母+9碼數字
    expect(validateResidentPermit("F901260600")).toBe(true);  // 實際資料樣本
    expect(validateResidentPermit("H901092480")).toBe(true);  // 實際資料樣本
    expect(validateResidentPermit("B212345678")).toBe(true);  // 字母+9碼數字
    expect(validateResidentPermit("AB12345678")).toBe(true);  // 新式：2字母+8碼數字
  });
  it("rejects invalid format", () => {
    expect(validateResidentPermit("1123456789")).toBe(false); // starts with digit
    expect(validateResidentPermit("A12345678")).toBe(false);  // too short (9 chars)
    expect(validateResidentPermit("A1234567890")).toBe(false); // too long (11 chars)
    expect(validateResidentPermit("")).toBe(false);            // empty
  });
});

describe("validatePassport", () => {
  it("accepts valid passport numbers", () => {
    expect(validatePassport("AB1234")).toBe(true);
    expect(validatePassport("VN123456")).toBe(true);
    expect(validatePassport("PH456789A")).toBe(true);
  });
  it("rejects invalid passport numbers", () => {
    expect(validatePassport("AB123")).toBe(false);    // too short
    expect(validatePassport("AB1234567890")).toBe(false); // too long
    expect(validatePassport("AB-1234")).toBe(false);  // special char
  });
});

describe("validateTaxId", () => {
  it("accepts valid tax IDs", () => {
    // 使用已知有效的統一編號
    expect(validateTaxId("12345678")).toBe(false); // 隨機數字，非有效統編
    // 已知有效統編：04595257（台積電）
    expect(validateTaxId("04595257")).toBe(true);
  });
  it("rejects non-8-digit strings", () => {
    expect(validateTaxId("1234567")).toBe(false);
    expect(validateTaxId("123456789")).toBe(false);
    expect(validateTaxId("abcdefgh")).toBe(false);
  });
});

describe("validateNotFutureDate", () => {
  it("accepts past dates", () => {
    expect(validateNotFutureDate("2020-01-01")).toBe(true);
    expect(validateNotFutureDate("2023-06-15")).toBe(true);
  });
  it("rejects future dates", () => {
    expect(validateNotFutureDate("2099-01-01")).toBe(false);
  });
  it("rejects invalid dates", () => {
    expect(validateNotFutureDate("not-a-date")).toBe(false);
    expect(validateNotFutureDate("")).toBe(false);
  });
});
