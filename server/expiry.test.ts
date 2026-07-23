/**
 * 到期分級引擎（shared/expiry.ts）——單元測試。
 *
 * 鎖住證件上色分段（14/30/90）、剩餘天數文字、緊迫判定、以字串計日的 daysUntil，
 * 並確認固定期限分級 classifyDeadline 能從統一門面 @shared/expiry 取用。
 */
import { describe, it, expect } from "vitest";
import {
  expiryTier,
  expiryLabel,
  isExpiryUrgent,
  daysUntil,
  classifyDeadline,
} from "@shared/expiry";

describe("expiryTier 分段（邊界）", () => {
  it("已過期 → expired", () => {
    expect(expiryTier(-1)).toBe("expired");
    expect(expiryTier(-100)).toBe("expired");
  });
  it("0~14 天 → critical（含 0 與 14）", () => {
    expect(expiryTier(0)).toBe("critical");
    expect(expiryTier(14)).toBe("critical");
  });
  it("15~30 天 → warning（含 15 與 30）", () => {
    expect(expiryTier(15)).toBe("warning");
    expect(expiryTier(30)).toBe("warning");
  });
  it("31~90 天 → notice（含 31 與 90）", () => {
    expect(expiryTier(31)).toBe("notice");
    expect(expiryTier(90)).toBe("notice");
  });
  it("91 天以上 → ok", () => {
    expect(expiryTier(91)).toBe("ok");
    expect(expiryTier(999)).toBe("ok");
  });
});

describe("expiryLabel 文字", () => {
  it("負數 → 已過期 N 天", () => {
    expect(expiryLabel(-3)).toBe("已過期 3 天");
  });
  it("0 → 今日到期", () => {
    expect(expiryLabel(0)).toBe("今日到期");
  });
  it("正數 → 剩 N 天", () => {
    expect(expiryLabel(12)).toBe("剩 12 天");
  });
});

describe("isExpiryUrgent（30 天內或已過期）", () => {
  it("過期/critical/warning → true", () => {
    expect(isExpiryUrgent(-1)).toBe(true);
    expect(isExpiryUrgent(14)).toBe(true);
    expect(isExpiryUrgent(30)).toBe(true);
  });
  it("notice/ok → false", () => {
    expect(isExpiryUrgent(31)).toBe(false);
    expect(isExpiryUrgent(200)).toBe(false);
  });
});

describe("daysUntil（以 YYYY-MM-DD 計整日差，與時區無關）", () => {
  it("到期日在未來 → 正數", () => {
    expect(daysUntil("2026-07-31", "2026-07-21")).toBe(10);
  });
  it("同日 → 0", () => {
    expect(daysUntil("2026-07-21", "2026-07-21")).toBe(0);
  });
  it("已過期 → 負數", () => {
    expect(daysUntil("2026-07-18", "2026-07-21")).toBe(-3);
  });
  it("跨月正確", () => {
    expect(daysUntil("2026-08-01", "2026-07-21")).toBe(11);
  });
  it("容忍帶時間的字串（取前 10 字）", () => {
    expect(daysUntil("2026-07-31T09:00:00", "2026-07-21")).toBe(10);
  });
  it("非法字串 → NaN", () => {
    expect(Number.isNaN(daysUntil("bad", "2026-07-21"))).toBe(true);
  });
});

describe("統一門面：classifyDeadline 可從 @shared/expiry 取用（60/120）", () => {
  it("距到期 ≤ 60 天 → due_now", () => {
    // 2026-07-21 → 2026-08-20 為 30 天
    expect(classifyDeadline("2026-08-20", "2026-07-21")!.status).toBe(
      "due_now"
    );
  });
  it("已過期 → overdue", () => {
    expect(classifyDeadline("2026-06-01", "2026-07-21")!.status).toBe(
      "overdue"
    );
  });
});
