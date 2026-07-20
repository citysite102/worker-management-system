/**
 * StatusBadge 的元件測試。
 *
 * 這個元件把「代碼」翻成使用者看到的中文標籤與顏色，錯了不會噴任何錯誤，
 * 只會安靜地顯示錯的字或沒有顏色的裸標籤 —— 正是需要測試盯住的那種東西。
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge 標籤文字", () => {
  it("顯示代碼對應的中文，而不是代碼本身", () => {
    render(<StatusBadge status="idle_in_tw" />);
    expect(screen.getByTestId("status-badge")).toHaveTextContent(
      "待業中（在台灣）"
    );
  });

  it("指定 domain 時用該領域的標籤", () => {
    // employed 在移工生命週期是「在職中」，在配對階段是「聘僱中」
    render(<StatusBadge status="employed" domain="lifecycle" />);
    expect(screen.getByTestId("status-badge")).toHaveTextContent("在職中");
  });

  it("同一個代碼在另一個 domain 顯示另一個標籤", () => {
    render(<StatusBadge status="employed" domain="assignmentStage" />);
    expect(screen.getByTestId("status-badge")).toHaveTextContent("聘僱中");
  });

  it("未知代碼原樣顯示而非空白", () => {
    render(<StatusBadge status="unknown_code" />);
    expect(screen.getByTestId("status-badge")).toHaveTextContent(
      "unknown_code"
    );
  });
});

describe("StatusBadge 顏色", () => {
  // 每個 StatusColor 都必須對應到一個實際的 CSS class。少一個分支，
  // 該狀態就會渲染成沒有背景色的裸標籤 —— blue 曾經就是這樣漏掉的。
  const cases: [string, string][] = [
    ["employed", "status-green"],
    ["idle_in_tw", "status-amber"],
    ["pending_supplement", "status-red"],
    ["preparing_abroad", "status-blue"],
    ["in_progress", "status-blue"],
    ["not_started", "status-gray"],
  ];

  for (const [status, expectedClass] of cases) {
    it(`${status} 套用 ${expectedClass}`, () => {
      render(<StatusBadge status={status} />);
      expect(screen.getByTestId("status-badge")).toHaveClass(expectedClass);
    });
  }

  it("未知代碼退回灰色，不會變成沒有顏色的裸標籤", () => {
    render(<StatusBadge status="unknown_code" />);
    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveClass("status-gray");
  });

  it("一定會有其中一個顏色 class", () => {
    const colorClasses = [
      "status-green",
      "status-amber",
      "status-red",
      "status-blue",
      "status-gray",
    ];
    for (const [status] of cases) {
      const { unmount } = render(<StatusBadge status={status} />);
      const cls = screen.getByTestId("status-badge").className;
      expect(
        colorClasses.some(c => cls.split(/\s+/).includes(c)),
        `${status} 沒有套用任何顏色 class：${cls}`
      ).toBe(true);
      unmount();
    }
  });
});

describe("StatusBadge 其他", () => {
  it("把 status 放進 data-status，方便 E2E 精確定位", () => {
    render(<StatusBadge status="paused" />);
    expect(screen.getByTestId("status-badge")).toHaveAttribute(
      "data-status",
      "paused"
    );
  });

  it("外部傳入的 className 會被保留", () => {
    render(<StatusBadge status="employed" className="ml-2" />);
    expect(screen.getByTestId("status-badge")).toHaveClass("ml-2");
  });
});
