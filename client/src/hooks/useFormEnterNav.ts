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
  return function handleEnterNav(e: KeyboardEvent<HTMLInputElement>) {
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
