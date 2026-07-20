/**
 * useComposition 的測試。
 *
 * 這個 hook 處理輸入法（IME）選字期間的按鍵。中文使用者打字時，Enter 與 Esc
 * 是給輸入法用的（確認選字 / 取消選字），不該讓外層的表單或 Dialog 收到 ——
 * 否則會出現「打到一半按 Enter，Dialog 直接關掉」這種讓人抓狂的行為。
 *
 * 特別注意 compositionEnd 之後的兩層 setTimeout：那是為了處理 Safari 中
 * compositionEnd 早於 keydown 觸發的順序問題。用假時鐘精確驗證這個時序，
 * 不然改壞了也不會有人發現（除非有人剛好用 Safari 打中文）。
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useComposition } from "./useComposition";

/** 造一個帶 stopPropagation 間諜的假 KeyboardEvent。 */
function keyEvent(key: string, { shiftKey = false } = {}) {
  return {
    key,
    shiftKey,
    stopPropagation: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLInputElement> & {
    stopPropagation: ReturnType<typeof vi.fn>;
  };
}

const compositionEvent = {} as React.CompositionEvent<HTMLInputElement>;

/**
 * 讓 compositionEnd 的兩層 setTimeout 都跑完。
 * 內層是在外層執行時才排入的，所以要用 runAllTimers 才會一路排乾。
 */
function flushCompositionEnd() {
  act(() => {
    vi.runAllTimers();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useComposition 的選字狀態", () => {
  it("初始不在選字中", () => {
    const { result } = renderHook(() => useComposition());
    expect(result.current.isComposing()).toBe(false);
  });

  it("compositionStart 之後進入選字狀態", () => {
    const { result } = renderHook(() => useComposition());

    act(() => result.current.onCompositionStart(compositionEvent));

    expect(result.current.isComposing()).toBe(true);
  });

  it("compositionEnd 之後要等兩輪 timer 才離開選字狀態", () => {
    const { result } = renderHook(() => useComposition());
    act(() => result.current.onCompositionStart(compositionEvent));

    act(() => result.current.onCompositionEnd(compositionEvent));
    // 這是刻意的延遲 —— Safari 會在 keydown 之前就送出 compositionEnd，
    // 立刻清掉狀態的話那個 keydown 就會被誤判成「不在選字中」。
    expect(result.current.isComposing()).toBe(true);

    // 第一層 timer 只負責排入第二層，狀態還不能清
    act(() => vi.advanceTimersToNextTimer());
    expect(result.current.isComposing()).toBe(true);

    // 第二層才真的清除
    act(() => vi.advanceTimersToNextTimer());
    expect(result.current.isComposing()).toBe(false);
  });

  it("連續選字時，新的 compositionStart 會取消前一次待清除的 timer", () => {
    const { result } = renderHook(() => useComposition());

    act(() => result.current.onCompositionStart(compositionEvent));
    act(() => result.current.onCompositionEnd(compositionEvent));
    // 還沒清完就又開始下一段選字（連續打字很常見）
    act(() => result.current.onCompositionStart(compositionEvent));

    flushCompositionEnd();

    // 舊的 timer 若沒被取消，這裡會被錯誤地清成 false
    expect(result.current.isComposing()).toBe(true);
  });
});

describe("useComposition 的按鍵攔截", () => {
  it("選字中按 Enter 會擋下冒泡，不讓外層表單收到", () => {
    const onKeyDown = vi.fn();
    const { result } = renderHook(() => useComposition({ onKeyDown }));
    act(() => result.current.onCompositionStart(compositionEvent));

    const e = keyEvent("Enter");
    act(() => result.current.onKeyDown(e));

    expect(e.stopPropagation).toHaveBeenCalled();
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it("選字中按 Esc 也擋下（Esc 是取消選字，不是關閉 Dialog）", () => {
    const onKeyDown = vi.fn();
    const { result } = renderHook(() => useComposition({ onKeyDown }));
    act(() => result.current.onCompositionStart(compositionEvent));

    const e = keyEvent("Escape");
    act(() => result.current.onKeyDown(e));

    expect(e.stopPropagation).toHaveBeenCalled();
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it("選字中的 Shift+Enter 不擋（那是換行，不是確認選字）", () => {
    const onKeyDown = vi.fn();
    const { result } = renderHook(() => useComposition({ onKeyDown }));
    act(() => result.current.onCompositionStart(compositionEvent));

    const e = keyEvent("Enter", { shiftKey: true });
    act(() => result.current.onKeyDown(e));

    expect(e.stopPropagation).not.toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalled();
  });

  it("選字中的其他按鍵照常往下傳", () => {
    const onKeyDown = vi.fn();
    const { result } = renderHook(() => useComposition({ onKeyDown }));
    act(() => result.current.onCompositionStart(compositionEvent));

    const e = keyEvent("a");
    act(() => result.current.onKeyDown(e));

    expect(e.stopPropagation).not.toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalled();
  });

  it("沒在選字時 Enter 正常往下傳", () => {
    const onKeyDown = vi.fn();
    const { result } = renderHook(() => useComposition({ onKeyDown }));

    const e = keyEvent("Enter");
    act(() => result.current.onKeyDown(e));

    expect(e.stopPropagation).not.toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalled();
  });

  it("選字結束並等待完成後，Enter 就會正常往下傳", () => {
    const onKeyDown = vi.fn();
    const { result } = renderHook(() => useComposition({ onKeyDown }));

    act(() => result.current.onCompositionStart(compositionEvent));
    act(() => result.current.onCompositionEnd(compositionEvent));
    flushCompositionEnd();

    const e = keyEvent("Enter");
    act(() => result.current.onKeyDown(e));

    expect(onKeyDown).toHaveBeenCalled();
  });

  it("compositionEnd 後的空窗期內，Enter 仍被擋下（Safari 的順序問題）", () => {
    const onKeyDown = vi.fn();
    const { result } = renderHook(() => useComposition({ onKeyDown }));

    act(() => result.current.onCompositionStart(compositionEvent));
    act(() => result.current.onCompositionEnd(compositionEvent));
    // 不 flush —— 模擬 Safari 在 compositionEnd 之後、狀態清除之前就送來 keydown

    const e = keyEvent("Enter");
    act(() => result.current.onKeyDown(e));

    expect(e.stopPropagation).toHaveBeenCalled();
    expect(onKeyDown).not.toHaveBeenCalled();
  });
});

describe("useComposition 對外部 handler 的轉呼叫", () => {
  it("compositionStart / compositionEnd 都會轉呼叫外部 handler", () => {
    const onCompositionStart = vi.fn();
    const onCompositionEnd = vi.fn();
    const { result } = renderHook(() =>
      useComposition({ onCompositionStart, onCompositionEnd })
    );

    act(() => result.current.onCompositionStart(compositionEvent));
    act(() => result.current.onCompositionEnd(compositionEvent));

    expect(onCompositionStart).toHaveBeenCalledOnce();
    expect(onCompositionEnd).toHaveBeenCalledOnce();
  });

  it("沒給任何 handler 也不會爆掉", () => {
    const { result } = renderHook(() => useComposition());

    expect(() => {
      act(() => result.current.onCompositionStart(compositionEvent));
      act(() => result.current.onKeyDown(keyEvent("Enter")));
      act(() => result.current.onCompositionEnd(compositionEvent));
      flushCompositionEnd();
    }).not.toThrow();
  });

  it("回傳的 handler 在重新 render 後保持同一個參考（usePersistFn）", () => {
    const { result, rerender } = renderHook(() => useComposition());
    const first = result.current.onKeyDown;

    rerender();

    // 參考不穩定的話，掛著它的子元件每次 render 都會被迫重繪
    expect(result.current.onKeyDown).toBe(first);
  });
});
