/**
 * RequireAuth 的元件測試。
 *
 * 這道守衛決定「未登入時導去哪」與「登入後能不能進頁面」。使用者回報的
 * 「點我要找工作、登入後卻被丟回首頁」正是因為守衛沒把原目的地帶進登入頁；
 * 這裡把「導向 /login?next=<原路徑>」釘死，避免再次退步。
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/trpc", async () => {
  const { trpcMock } = await import("@/__tests__/trpcMock");
  return { trpc: trpcMock };
});

// 固定當前位置為 /jobs；Redirect 換成看得見 to 的標記元素。
vi.mock("wouter", () => ({
  useLocation: () => ["/jobs", vi.fn()],
  useSearch: () => "",
  Redirect: ({ to }: { to: string }) => (
    <div data-testid="redirect" data-to={to} />
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { RequireAuth } from "./RequireAuth";
import {
  resetTrpcMock,
  setQueryData,
  setQueryLoading,
} from "@/__tests__/trpcMock";

beforeEach(() => resetTrpcMock());

describe("RequireAuth", () => {
  it("未登入 → 導向 /login 並帶上 next=原路徑（迴歸：登入後不該回首頁）", () => {
    setQueryData("auth.me", null);
    render(
      <RequireAuth>
        <div data-testid="child" />
      </RequireAuth>
    );
    const redirect = screen.getByTestId("redirect");
    expect(redirect.getAttribute("data-to")).toBe("/login?next=%2Fjobs");
    expect(screen.queryByTestId("child")).toBeNull();
  });

  it("已登入 → 顯示內容", () => {
    setQueryData("auth.me", { role: "user", accountType: "worker" });
    render(
      <RequireAuth>
        <div data-testid="child" />
      </RequireAuth>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByTestId("redirect")).toBeNull();
  });

  it("載入中 → 不導向也不顯示內容", () => {
    setQueryLoading("auth.me");
    render(
      <RequireAuth>
        <div data-testid="child" />
      </RequireAuth>
    );
    expect(screen.queryByTestId("child")).toBeNull();
    expect(screen.queryByTestId("redirect")).toBeNull();
  });

  it("要求雇主但登入者是移工 → 擋下（不顯示內容、不導向）", () => {
    setQueryData("auth.me", { role: "user", accountType: "worker" });
    render(
      <RequireAuth accountType="employer">
        <div data-testid="child" />
      </RequireAuth>
    );
    expect(screen.queryByTestId("child")).toBeNull();
    expect(screen.queryByTestId("redirect")).toBeNull();
  });

  it("要求雇主、登入者是雇主 → 放行", () => {
    setQueryData("auth.me", { role: "user", accountType: "employer" });
    render(
      <RequireAuth accountType="employer">
        <div data-testid="child" />
      </RequireAuth>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("staff 可進雇主專區（代操作）", () => {
    setQueryData("auth.me", { role: "staff", accountType: null });
    render(
      <RequireAuth accountType="employer">
        <div data-testid="child" />
      </RequireAuth>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
