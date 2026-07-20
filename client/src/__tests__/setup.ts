/**
 * 前端測試的全域 setup。
 *
 * jsdom 沒有實作瀏覽器的一些 API，Radix UI（本專案 UI 元件的底層）大量依賴
 * 它們，缺了會在 render 時直接爆掉。這裡補上最小可用的 stub。
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// 每個 test 後卸載元件，避免 DOM 殘留污染下一個 test。
afterEach(() => {
  cleanup();
});

// Radix 的 Select / Dialog / Tooltip 都會用到，jsdom 沒有實作。
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof window.ResizeObserver;
}

if (!window.IntersectionObserver) {
  window.IntersectionObserver = class {
    root = null;
    rootMargin = "";
    thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof window.IntersectionObserver;
}

// Radix 的 Select 在開啟時會呼叫，jsdom 未實作會拋錯。
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
}
