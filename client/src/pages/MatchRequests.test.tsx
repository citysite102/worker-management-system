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

import MatchRequests from "./MatchRequests";
import {
  resetTrpcMock,
  setQueryData,
  setQueryLoading,
  getMutation,
} from "@/__tests__/trpcMock";

const ROW = {
  id: 7,
  initiatorUserId: 3,
  initiatorType: "employer",
  initiatorName: "王雇主",
  initiatorEmail: "e@x.co",
  initiatorPhone: "0912345678",
  targetType: "worker",
  targetId: 5,
  status: "staff_handling",
  note: "希望盡快安排",
  staffNote: null,
  closeReason: null,
  assignedStaffId: null,
  targetJobType: "caregiver",
  targetCity: "臺北市",
  targetLabel: "外籍工作者 #5",
  createdAt: null,
  updatedAt: null,
};

beforeEach(() => resetTrpcMock());

describe("後台意向審核（MatchRequests）", () => {
  it("載入中顯示骨架（SkeletonList），非純文字", () => {
    setQueryLoading("matchRequests.queue");
    render(<MatchRequests />);
    expect(screen.getByTestId("skeleton-list")).toBeInTheDocument();
  });

  it("顯示意向列，含發起者留言", () => {
    setQueryData("matchRequests.queue", [ROW]);
    render(<MatchRequests />);
    expect(screen.getByTestId("match-row")).toBeInTheDocument();
    expect(screen.getByText(/希望盡快安排/)).toBeInTheDocument();
  });

  it("編輯內部備註 / 關閉原因 → 帶目前狀態送出 updateStatus", async () => {
    const user = userEvent.setup();
    setQueryData("matchRequests.queue", [ROW]);
    render(<MatchRequests />);

    // 展開編輯器
    await user.click(screen.getByTestId("match-notes-toggle-7"));
    await user.type(screen.getByTestId("match-staffNote-7"), "已電聯雇主");
    await user.type(screen.getByTestId("match-closeReason-7"), "雇主取消需求");
    await user.click(screen.getByTestId("match-notes-save-7"));

    expect(
      getMutation("matchRequests.updateStatus").mutate
    ).toHaveBeenCalledWith({
      id: 7,
      status: "staff_handling",
      staffNote: "已電聯雇主",
      closeReason: "雇主取消需求",
    });
  });

  it("已存的備註 / 關閉原因會顯示在卡片上", () => {
    setQueryData("matchRequests.queue", [
      { ...ROW, staffNote: "處理中備註", closeReason: "已媒合他人" },
    ]);
    render(<MatchRequests />);
    expect(screen.getByText(/內部備註：處理中備註/)).toBeInTheDocument();
    expect(screen.getByText(/關閉原因：已媒合他人/)).toBeInTheDocument();
  });
});
