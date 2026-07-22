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
// 使用真實 i18n（WorkerProfile → PublicHeader → LanguageSwitcher 會自我初始化 i18n）；
// 測試以 data-testid 選取，不綁文案。

import WorkerProfile from "./WorkerProfile";
import { resetTrpcMock, setQueryData, getMutation } from "@/__tests__/trpcMock";

beforeEach(() => {
  resetTrpcMock();
  setQueryData("worker.myProfile", null);
  setQueryData("worker.myExperiences", []);
});

describe("我的履歷：期望工作地區（可多選，點選即可）", () => {
  it("渲染縣市選項且不需打字", () => {
    render(<WorkerProfile />);
    expect(screen.getByTestId("profile-preferredCities")).toBeInTheDocument();
    expect(screen.getByTestId("profile-city-臺北市")).toBeInTheDocument();
  });

  it("點選縣市 → 送出時 payload 帶 preferredCities", async () => {
    const user = userEvent.setup();
    render(<WorkerProfile />);

    await user.click(screen.getByTestId("profile-city-臺北市"));
    await user.click(screen.getByTestId("profile-city-新北市"));
    await user.click(screen.getByTestId("profile-submit"));

    expect(getMutation("worker.upsertProfile").mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredCities: ["臺北市", "新北市"],
        submit: true,
      })
    );
  });

  it("點兩下同一縣市 → 取消選取（不進 payload）", async () => {
    const user = userEvent.setup();
    render(<WorkerProfile />);

    await user.click(screen.getByTestId("profile-city-桃園市"));
    await user.click(screen.getByTestId("profile-city-桃園市"));
    await user.click(screen.getByTestId("profile-save-draft"));

    expect(getMutation("worker.upsertProfile").mutate).toHaveBeenCalledWith(
      expect.objectContaining({ preferredCities: undefined, submit: false })
    );
  });
});
