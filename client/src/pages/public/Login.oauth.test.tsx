import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/trpc", async () => {
  const { trpcMock } = await import("@/__tests__/trpcMock");
  return { trpc: trpcMock };
});
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import Login from "./Login";
import { resetTrpcMock, setQueryData } from "@/__tests__/trpcMock";

beforeEach(() => resetTrpcMock());

describe("登入頁：社群登入鈕（依已啟用 provider 顯示）", () => {
  it("有啟用 provider → 顯示對應鈕，href 指向 /auth/oauth/<id>/start", () => {
    setQueryData("auth.oauthProviders", ["google", "line"]);
    render(<Login />);
    expect(screen.getByTestId("oauth-google")).toHaveAttribute(
      "href",
      "/auth/oauth/google/start"
    );
    expect(screen.getByTestId("oauth-line")).toHaveAttribute(
      "href",
      "/auth/oauth/line/start"
    );
    expect(screen.queryByTestId("oauth-facebook")).toBeNull();
  });

  it("無啟用 provider（未設憑證）→ 完全不顯示社群區塊", () => {
    setQueryData("auth.oauthProviders", []);
    render(<Login />);
    expect(screen.queryByTestId("oauth-providers")).toBeNull();
  });
});
