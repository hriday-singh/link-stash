import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// jsdom has no matchMedia; tests override it when they need a match.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom has no scrollTo; navigation calls it.
window.scrollTo = () => {};

// jsdom has no scrollIntoView; cmdk calls it.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom has no Web Animations API getAnimations or animate; torph calls them.
if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => [];
}
const mockAnimate = () =>
  ({
    finished: Promise.resolve(),
    cancel: () => {},
    finish: () => {},
    play: () => {},
    pause: () => {},
    reverse: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as Animation;

if (typeof Element !== "undefined") {
  Element.prototype.animate = mockAnimate;
}
if (typeof HTMLElement !== "undefined") {
  HTMLElement.prototype.animate = mockAnimate;
}
if (typeof SVGElement !== "undefined") {
  SVGElement.prototype.animate = mockAnimate;
}
if (typeof window !== "undefined") {
  if (window.Element) window.Element.prototype.animate = mockAnimate;
  if (window.HTMLElement) window.HTMLElement.prototype.animate = mockAnimate;
  if (window.SVGElement) window.SVGElement.prototype.animate = mockAnimate;
}

// jsdom has no ResizeObserver
if (typeof globalThis.ResizeObserver === "undefined") {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}

// jsdom has no WebGL2RenderingContext needed by Sigma.js
if (typeof globalThis.WebGL2RenderingContext === "undefined") {
  const webglConstants: Record<string, number> = {
    BOOL: 0x8b56,
    BYTE: 0x1400,
    UNSIGNED_BYTE: 0x1401,
    SHORT: 0x1402,
    UNSIGNED_SHORT: 0x1403,
    INT: 0x1404,
    UNSIGNED_INT: 0x1405,
    FLOAT: 0x1406,
    RGBA: 0x1908,
  };
  const mockContext = function () {};
  Object.assign(mockContext, webglConstants);
  Object.assign(mockContext.prototype, webglConstants);
  globalThis.WebGL2RenderingContext = mockContext as unknown as typeof WebGL2RenderingContext;
}

if (typeof globalThis.WebGLRenderingContext === "undefined") {
  globalThis.WebGLRenderingContext =
    globalThis.WebGL2RenderingContext as unknown as typeof WebGLRenderingContext;
}
