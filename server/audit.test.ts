import { describe, it, expect } from "vitest";
import { getClientIp } from "./_core/audit";

describe("getClientIp", () => {
  it("優先取 x-forwarded-for 的第一段（Manus 反向代理）", () => {
    expect(
      getClientIp({ headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } })
    ).toBe("203.0.113.7");
  });
  it("x-forwarded-for 為陣列時取第一個", () => {
    expect(
      getClientIp({ headers: { "x-forwarded-for": ["198.51.100.2"] } })
    ).toBe("198.51.100.2");
  });
  it("無 x-forwarded-for 時退回 req.ip", () => {
    expect(getClientIp({ headers: {}, ip: "192.0.2.9" })).toBe("192.0.2.9");
  });
  it("退回 socket.remoteAddress", () => {
    expect(
      getClientIp({ headers: {}, socket: { remoteAddress: "192.0.2.55" } })
    ).toBe("192.0.2.55");
  });
  it("都沒有時回 undefined", () => {
    expect(getClientIp({ headers: {} })).toBeUndefined();
  });
});
