/**
 * 寄信器（EmailSender）單元測試：Resend 實作 + getEmailSender 的挑選邏輯。
 * 不真的打網路：mock 全域 fetch。
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { ResendEmailSender, resendConfig } from "./_core/email/resend";
import { getEmailSender, __setEmailSenderForTest } from "./_core/email/sender";

const savedEnv: Record<string, string | undefined> = {};
function setEnv(k: string, v: string | undefined) {
  if (!(k in savedEnv)) savedEnv[k] = process.env[k];
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
}

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  for (const k of Object.keys(savedEnv)) delete savedEnv[k];
  __setEmailSenderForTest(null);
  vi.unstubAllGlobals();
});

describe("ResendEmailSender", () => {
  it("以正確的 URL / 授權標頭 / payload 呼叫 Resend API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    const sender = new ResendEmailSender({
      apiKey: "re_test",
      from: "長誠媒合 <no-reply@example.com>",
    });
    await sender.send({
      to: "u@example.com",
      subject: "S",
      text: "T",
      html: "<p>T</p>",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(opts.method).toBe("POST");
    expect(opts.headers.authorization).toBe("Bearer re_test");
    expect(JSON.parse(opts.body)).toMatchObject({
      from: "長誠媒合 <no-reply@example.com>",
      to: "u@example.com",
      subject: "S",
      text: "T",
      html: "<p>T</p>",
    });
  });

  it("Resend 回非 2xx → 丟錯（不靜默）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => "invalid from",
      })
    );
    const sender = new ResendEmailSender({
      apiKey: "re_test",
      from: "x <a@b.com>",
    });
    await expect(
      sender.send({ to: "u@example.com", subject: "S", text: "T" })
    ).rejects.toThrow(/Resend/);
  });
});

describe("resendConfig / getEmailSender 挑選", () => {
  it("缺 env → resendConfig 回 null", () => {
    setEnv("RESEND_API_KEY", undefined);
    setEnv("EMAIL_FROM", undefined);
    expect(resendConfig()).toBeNull();
  });

  it("只設一半（缺 EMAIL_FROM）→ 仍回 null", () => {
    setEnv("RESEND_API_KEY", "re_x");
    setEnv("EMAIL_FROM", undefined);
    expect(resendConfig()).toBeNull();
  });

  it("設了 RESEND_API_KEY + EMAIL_FROM → getEmailSender 回 ResendEmailSender", () => {
    setEnv("RESEND_API_KEY", "re_x");
    setEnv("EMAIL_FROM", "長誠媒合 <no-reply@example.com>");
    __setEmailSenderForTest(null);
    expect(getEmailSender()).toBeInstanceOf(ResendEmailSender);
  });

  it("沒設憑證且非 production → 回退 Stub（不是 Resend）", () => {
    setEnv("RESEND_API_KEY", undefined);
    setEnv("EMAIL_FROM", undefined);
    __setEmailSenderForTest(null);
    expect(getEmailSender()).not.toBeInstanceOf(ResendEmailSender);
  });
});
