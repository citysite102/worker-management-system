/**
 * usePersistFn 的測試。
 *
 * 用途是「函式參考永遠不變，但呼叫到的永遠是最新的閉包」。這兩件事只滿足
 * 一件都會出事：
 *   - 參考變了 → 掛著它的子元件每次 render 都重繪，或 useEffect 反覆觸發
 *   - 閉包舊了 → 拿到過期的 state，是 React 最經典的 stale closure bug
 */
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { usePersistFn } from "./usePersistFn";

describe("usePersistFn", () => {
  it("多次 render 後參考維持不變", () => {
    const { result, rerender } = renderHook(() => usePersistFn(() => 1));
    const first = result.current;

    rerender();
    rerender();

    expect(result.current).toBe(first);
  });

  it("即使每次傳入的是新函式，回傳的參考仍不變", () => {
    let calls = 0;
    const { result, rerender } = renderHook(() =>
      usePersistFn(() => {
        calls++;
      })
    );
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
    expect(calls).toBe(0); // 只是持有，不會自己呼叫
  });

  it("呼叫時執行的是最新的函式，不是第一次那個（避免 stale closure）", () => {
    const { result, rerender } = renderHook(
      ({ value }) => usePersistFn(() => value),
      { initialProps: { value: "第一版" } }
    );
    const persisted = result.current;

    rerender({ value: "第二版" });

    // 參考沒變，但拿到的是新值
    expect(result.current).toBe(persisted);
    expect(persisted()).toBe("第二版");
  });

  it("讀得到最新的 state，不會停在初始值", () => {
    const { result } = renderHook(() => {
      const [count, setCount] = useState(0);
      const read = usePersistFn(() => count);
      return { count, setCount, read };
    });

    act(() => result.current.setCount(5));

    expect(result.current.read()).toBe(5);
  });

  it("參數會原樣傳進去", () => {
    const spy = vi.fn((a: number, b: string) => `${a}-${b}`);
    const { result } = renderHook(() => usePersistFn(spy));

    const returned = result.current(1, "甲");

    expect(spy).toHaveBeenCalledWith(1, "甲");
    expect(returned).toBe("1-甲");
  });

  it("回傳值會原樣傳出來", () => {
    const { result } = renderHook(() => usePersistFn(() => ({ ok: true })));
    expect(result.current()).toEqual({ ok: true });
  });

  it("拋出的例外會照常往外拋，不會被吞掉", () => {
    const { result } = renderHook(() =>
      usePersistFn(() => {
        throw new Error("內部錯誤");
      })
    );

    expect(() => result.current()).toThrow("內部錯誤");
  });

  it("this 綁定會被轉交", () => {
    const { result } = renderHook(() =>
      usePersistFn(function (this: { name: string }) {
        return this?.name;
      })
    );

    const obj = { name: "甲物件", run: result.current };

    expect(obj.run()).toBe("甲物件");
  });
});
