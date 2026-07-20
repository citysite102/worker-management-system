import { KeyboardEvent, RefObject } from "react";

/**
 * Returns an onKeyDown handler that advances focus to the next focusable
 * element inside a given container when Enter is pressed.
 *
 * - Skips Textarea elements (Enter = newline there)
 * - Skips elements with data-no-enter-nav attribute
 * - Submits the form when the last field is reached
 * - IME-safe: does nothing while composing (isComposing flag)
 */
export function useFormEnterNav(containerRef: RefObject<HTMLElement | null>) {
  // 參數型別用 HTMLElement 而非 HTMLInputElement：實作只用到 key / nativeEvent /
  // currentTarget / preventDefault，全都是 HTMLElement 就有的。寫死 input 會讓
  // 這個 handler 沒辦法掛到 textarea 或 select 上（雖然它們本來就會被跳過，
  // 但掛上去仍是合理用法）。放寬參數型別對呼叫端只會更寬鬆，不會破壞既有用法。
  return function handleEnterNav(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== "Enter") return;
    // IME safety: if the native event says we're composing, bail out
    if ((e.nativeEvent as any).isComposing) return;

    const container = containerRef.current;
    if (!container) return;

    // All focusable form elements inside the container
    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), button[type="submit"]'
      )
    ).filter(
      (el) =>
        !el.closest("[data-no-enter-nav]") &&
        el.getAttribute("tabindex") !== "-1"
    );

    const currentIndex = focusable.indexOf(e.currentTarget as HTMLElement);
    if (currentIndex === -1) return;

    const next = focusable[currentIndex + 1];
    if (next) {
      e.preventDefault();
      next.focus();
    }
    // If no next element, let the form's natural submit happen
  };
}
