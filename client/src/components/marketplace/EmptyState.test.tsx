import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Inbox } from "lucide-react";
import { EmptyState } from "./ui";

describe("EmptyState", () => {
  it("顯示訊息並透傳 data-testid", () => {
    render(
      <EmptyState icon={Inbox} data-testid="x-empty">
        目前沒有資料
      </EmptyState>
    );
    const el = screen.getByTestId("x-empty");
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent("目前沒有資料");
  });

  it("提供 action 時渲染下一步", () => {
    render(
      <EmptyState data-testid="y-empty" action={<button>新增</button>}>
        還沒有項目
      </EmptyState>
    );
    expect(screen.getByRole("button", { name: "新增" })).toBeInTheDocument();
  });
});
