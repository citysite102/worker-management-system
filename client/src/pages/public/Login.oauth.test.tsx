import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/trpc", async () => {
  const { trpcMock } = await import("@/__tests__/trpcMock");
  return { trpc: trpcMock };
});
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import Login from "./Login";
import { resetTrpcMock, setQueryData, getMutation } from "@/__tests__/trpcMock";

beforeEach(() => resetTrpcMock());

describe("登入頁：社群登入鈕（Google/Facebook，依已啟用 provider 顯示）", () => {
  it("有啟用 provider → 顯示對應鈕，href 指向 /auth/oauth/<id>/start", () => {
    setQueryData("auth.oauthProviders", ["google", "facebook"]);
    render(<Login />);
    expect(screen.getByTestId("oauth-google")).toHaveAttribute(
      "href",
      "/auth/oauth/google/start"
    );
    expect(screen.getByTestId("oauth-facebook")).toHaveAttribute(
      "href",
      "/auth/oauth/facebook/start"
    );
  });

  it("無啟用 provider 且 WhatsApp 關 → 完全不顯示替代登入區塊", () => {
    setQueryData("auth.oauthProviders", []);
    setQueryData("auth.whatsappEnabled", false);
    render(<Login />);
    expect(screen.queryByTestId("alt-login")).toBeNull();
    expect(screen.queryByTestId("wa-login")).toBeNull();
  });
});

describe("登入頁：WhatsApp 手機 OTP", () => {
  it("啟用時顯示手機登入；送出手機 → 呼叫 requestOtp；驗證 → 呼叫 verifyOtp", async () => {
    const user = userEvent.setup();
    setQueryData("auth.oauthProviders", []);
    setQueryData("auth.whatsappEnabled", true);
    render(<Login />);

    expect(screen.getByTestId("wa-login")).toBeInTheDocument();

    // 1) 輸入手機、送驗證碼
    await user.type(screen.getByTestId("wa-phone"), "+886912345678");
    await user.click(screen.getByTestId("wa-send"));
    expect(getMutation("auth.whatsappRequestOtp").mutate).toHaveBeenCalledWith({
      phone: "+886912345678",
    });

    // 2) mutate 成功 → 進入輸入碼階段
    const codeInput = await screen.findByTestId("wa-code");
    await user.type(codeInput, "123456");
    await user.click(screen.getByTestId("wa-verify"));
    expect(getMutation("auth.whatsappVerifyOtp").mutate).toHaveBeenCalledWith({
      phone: "+886912345678",
      code: "123456",
    });
  });
});
