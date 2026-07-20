/**
 * useFormEnterNav 的測試。
 *
 * 這個 hook 讓使用者按 Enter 就跳到下一個欄位（大量鍵盤輸入的後台很需要）。
 * 最關鍵的是 **IME 安全性**：中文使用者按 Enter 通常是要確認注音／拼音的選字，
 * 不是要跳欄位。這個判斷錯了，中文輸入會變得完全不能用 —— 而且只有實際用
 * 中文輸入法的人才會發現，用英文怎麼測都正常。
 */
import { render, screen } from "@testing-library/react";
import { createRef, useRef, type KeyboardEvent, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useFormEnterNav } from "./useFormEnterNav";

type Handler = (e: KeyboardEvent<HTMLElement>) => void;

/**
 * 用 render-prop 把 handler 明確傳給每個欄位。
 * handler 必須掛在「欄位本身」而不是表單上 —— hook 依賴 e.currentTarget
 * 判斷目前在第幾個欄位，掛在表單上的話 currentTarget 會是表單。
 */
function TestForm({ children }: { children: (h: Handler) => ReactNode }) {
  const ref = useRef<HTMLFormElement>(null);
  const handleEnterNav = useFormEnterNav(ref);
  return <form ref={ref}>{children(handleEnterNav)}</form>;
}

/** 觸發一次 keydown。isComposing 模擬輸入法選字中的狀態。 */
function pressEnter(
  el: HTMLElement,
  { isComposing = false, key = "Enter" } = {}
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "isComposing", { value: isComposing });
  el.dispatchEvent(event);
  return event;
}

const threeInputs = (h: Handler) => (
  <>
    <input data-testid="a" onKeyDown={h} />
    <input data-testid="b" onKeyDown={h} />
    <input data-testid="c" onKeyDown={h} />
  </>
);

describe("useFormEnterNav 基本行為", () => {
  it("按 Enter 跳到下一個欄位", () => {
    render(<TestForm>{threeInputs}</TestForm>);
    const a = screen.getByTestId("a");
    a.focus();

    pressEnter(a);

    expect(document.activeElement).toBe(screen.getByTestId("b"));
  });

  it("Enter 以外的按鍵不做事", () => {
    render(<TestForm>{threeInputs}</TestForm>);
    const a = screen.getByTestId("a");
    a.focus();

    pressEnter(a, { key: "a" });

    expect(document.activeElement).toBe(a);
  });

  it("跳欄位時會 preventDefault，避免同時觸發表單送出", () => {
    render(<TestForm>{threeInputs}</TestForm>);
    const a = screen.getByTestId("a");
    a.focus();

    expect(pressEnter(a).defaultPrevented).toBe(true);
  });

  it("最後一個欄位按 Enter 不攔截，讓表單自然送出", () => {
    render(<TestForm>{threeInputs}</TestForm>);
    const c = screen.getByTestId("c");
    c.focus();

    const event = pressEnter(c);

    // 沒有下一個欄位時不呼叫 preventDefault，表單的原生送出行為才會發生
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(c);
  });
});

describe("useFormEnterNav 的 IME 安全性", () => {
  it("輸入法選字中按 Enter 不跳欄位", () => {
    render(<TestForm>{threeInputs}</TestForm>);
    const a = screen.getByTestId("a");
    a.focus();

    // 中文使用者打「ㄊㄞˊㄅㄟˇ」按 Enter 是要確認選字，不是要跳下一欄
    pressEnter(a, { isComposing: true });

    expect(document.activeElement).toBe(a);
  });

  it("選字中按 Enter 也不會 preventDefault（不能干擾輸入法）", () => {
    render(<TestForm>{threeInputs}</TestForm>);
    const a = screen.getByTestId("a");
    a.focus();

    expect(pressEnter(a, { isComposing: true }).defaultPrevented).toBe(false);
  });

  it("選字結束後再按 Enter 就會正常跳欄位", () => {
    render(<TestForm>{threeInputs}</TestForm>);
    const a = screen.getByTestId("a");
    a.focus();

    pressEnter(a, { isComposing: true }); // 這一下是確認選字
    pressEnter(a, { isComposing: false }); // 再按一次才是跳欄位

    expect(document.activeElement).toBe(screen.getByTestId("b"));
  });
});

describe("useFormEnterNav 的跳過規則", () => {
  it("textarea 不會被當成跳轉目標（Enter 在那裡是換行）", () => {
    render(
      <TestForm>
        {h => (
          <>
            <input data-testid="a" onKeyDown={h} />
            <textarea data-testid="note" onKeyDown={h} />
            <input data-testid="b" onKeyDown={h} />
          </>
        )}
      </TestForm>
    );
    const a = screen.getByTestId("a");
    a.focus();

    pressEnter(a);

    expect(document.activeElement).toBe(screen.getByTestId("b"));
  });

  it("disabled 欄位會被跳過", () => {
    render(
      <TestForm>
        {h => (
          <>
            <input data-testid="a" onKeyDown={h} />
            <input data-testid="skipped" disabled onKeyDown={h} />
            <input data-testid="b" onKeyDown={h} />
          </>
        )}
      </TestForm>
    );
    const a = screen.getByTestId("a");
    a.focus();

    pressEnter(a);

    expect(document.activeElement).toBe(screen.getByTestId("b"));
  });

  it("hidden input 會被跳過", () => {
    render(
      <TestForm>
        {h => (
          <>
            <input data-testid="a" onKeyDown={h} />
            <input type="hidden" onKeyDown={h} />
            <input data-testid="b" onKeyDown={h} />
          </>
        )}
      </TestForm>
    );
    const a = screen.getByTestId("a");
    a.focus();

    pressEnter(a);

    expect(document.activeElement).toBe(screen.getByTestId("b"));
  });

  it("data-no-enter-nav 區塊內的欄位會被跳過", () => {
    render(
      <TestForm>
        {h => (
          <>
            <input data-testid="a" onKeyDown={h} />
            <div data-no-enter-nav>
              <input data-testid="excluded" onKeyDown={h} />
            </div>
            <input data-testid="b" onKeyDown={h} />
          </>
        )}
      </TestForm>
    );
    const a = screen.getByTestId("a");
    a.focus();

    pressEnter(a);

    expect(document.activeElement).toBe(screen.getByTestId("b"));
  });

  it("tabindex=-1 的欄位會被跳過", () => {
    render(
      <TestForm>
        {h => (
          <>
            <input data-testid="a" onKeyDown={h} />
            <input data-testid="untabbable" tabIndex={-1} onKeyDown={h} />
            <input data-testid="b" onKeyDown={h} />
          </>
        )}
      </TestForm>
    );
    const a = screen.getByTestId("a");
    a.focus();

    pressEnter(a);

    expect(document.activeElement).toBe(screen.getByTestId("b"));
  });

  it("select 會被當成跳轉目標（不是只有 input）", () => {
    render(
      <TestForm>
        {h => (
          <>
            <input data-testid="a" onKeyDown={h} />
            <select data-testid="sel" onKeyDown={h}>
              <option>甲</option>
            </select>
          </>
        )}
      </TestForm>
    );
    const a = screen.getByTestId("a");
    a.focus();

    pressEnter(a);

    expect(document.activeElement).toBe(screen.getByTestId("sel"));
  });
});

describe("useFormEnterNav 的邊界情況", () => {
  it("container ref 還沒掛上時不會爆掉", () => {
    function Detached() {
      const ref = createRef<HTMLDivElement>();
      const handle = useFormEnterNav(ref);
      return <input data-testid="lonely" onKeyDown={handle} />;
    }
    render(<Detached />);
    const input = screen.getByTestId("lonely");
    input.focus();

    expect(() => pressEnter(input)).not.toThrow();
    expect(document.activeElement).toBe(input);
  });

  it("觸發元素不在 container 內時不做事", () => {
    function Outside() {
      const ref = useRef<HTMLDivElement>(null);
      const handle = useFormEnterNav(ref);
      return (
        <>
          <div ref={ref}>
            <input data-testid="inside" />
          </div>
          <input data-testid="outside" onKeyDown={handle} />
        </>
      );
    }
    render(<Outside />);
    const outside = screen.getByTestId("outside");
    outside.focus();

    pressEnter(outside);

    expect(document.activeElement).toBe(outside);
  });
});
