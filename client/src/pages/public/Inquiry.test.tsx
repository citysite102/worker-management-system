/**
 * Inquiry（開放諮詢入口，§8）元件測試。
 *
 * 釘死安全相關路徑：未登入按「送出諮詢」必須導去 /login?next=，且
 * **不得**呼叫 submitInquiry mutation（避免匿名寫入）；登入者送出才真的建立意向。
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/trpc", async () => {
  const { trpcMock } = await import("@/__tests__/trpcMock");
  return { trpc: trpcMock };
});

const navigate = vi.hoisted(() => vi.fn());
vi.mock("wouter", () => ({
  useLocation: () => ["/inquiry", navigate],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "zh-TW" },
  }),
}));

vi.mock("@/components/public/PublicHeader", () => ({
  PublicHeader: () => null,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// 可切換的登入狀態
const authState = vi.hoisted(() => ({ isAuthenticated: false }));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

import Inquiry from "./Inquiry";
import {
  resetTrpcMock,
  getMutation,
  setMutationSuccess,
} from "@/__tests__/trpcMock";

beforeEach(() => {
  resetTrpcMock();
  navigate.mockClear();
  authState.isAuthenticated = false;
});

describe("Inquiry 開放諮詢入口", () => {
  it("未登入按送出 → 導向 /login?next=/inquiry，且不呼叫 submitInquiry", () => {
    render(<Inquiry />);
    fireEvent.click(screen.getByTestId("inquiry-submit"));
    expect(navigate).toHaveBeenCalledWith("/login?next=%2Finquiry");
    expect(
      getMutation("publicJobs.submitInquiry").mutate
    ).not.toHaveBeenCalled();
  });

  it("登入者送出 → 呼叫 submitInquiry 帶所選類別，並顯示已送出", () => {
    authState.isAuthenticated = true;
    setMutationSuccess("publicJobs.submitInquiry", {
      success: true,
      alreadySent: false,
    });
    render(<Inquiry />);
    // 選一個明確類別（預設為 unsure）
    fireEvent.change(screen.getByTestId("inquiry-category"), {
      target: { value: "caregiver" },
    });
    fireEvent.click(screen.getByTestId("inquiry-submit"));
    expect(getMutation("publicJobs.submitInquiry").mutate).toHaveBeenCalledWith(
      expect.objectContaining({ inquiryCategory: "caregiver" })
    );
    // onSuccess → 進入已送出狀態
    expect(screen.getByTestId("inquiry-done")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
