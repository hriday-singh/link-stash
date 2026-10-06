import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  SidebarProvider,
  useSidebar,
} from "./sidebar";

describe("SidebarProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("provides default width and collapsed state", () => {
    const { result } = renderHook(() => useSidebar(), {
      wrapper: SidebarProvider,
    });
    expect(result.current.width).toBe(DEFAULT_SIDEBAR_WIDTH);
    expect(result.current.collapsed).toBe(false);
    expect(result.current.mobileOpen).toBe(false);
  });

  it("persists width and clamps to min and max boundaries", () => {
    const { result } = renderHook(() => useSidebar(), {
      wrapper: SidebarProvider,
    });

    act(() => {
      result.current.setWidth(100); // below min
    });
    expect(result.current.width).toBe(MIN_SIDEBAR_WIDTH);

    act(() => {
      result.current.setWidth(800); // above max
    });
    expect(result.current.width).toBe(MAX_SIDEBAR_WIDTH);

    act(() => {
      result.current.setWidth(320); // within range
    });
    expect(result.current.width).toBe(320);

    const saved = JSON.parse(window.localStorage.getItem("stash:sidebar:state") || "{}");
    expect(saved.width).toBe(320);
  });

  it("persists collapsed state toggle", () => {
    const { result } = renderHook(() => useSidebar(), {
      wrapper: SidebarProvider,
    });

    act(() => {
      result.current.toggleCollapsed();
    });
    expect(result.current.collapsed).toBe(true);

    const saved = JSON.parse(window.localStorage.getItem("stash:sidebar:state") || "{}");
    expect(saved.collapsed).toBe(true);

    act(() => {
      result.current.toggleCollapsed();
    });
    expect(result.current.collapsed).toBe(false);
  });

  it("falls back gracefully when localStorage contains garbage or throws", () => {
    window.localStorage.setItem("stash:sidebar:state", "INVALID JSON{[[[");
    const { result: r1 } = renderHook(() => useSidebar(), {
      wrapper: SidebarProvider,
    });
    expect(r1.current.width).toBe(DEFAULT_SIDEBAR_WIDTH);
    expect(r1.current.collapsed).toBe(false);

    // Mock localStorage getItem to throw
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: Access denied");
    });
    const { result: r2 } = renderHook(() => useSidebar(), {
      wrapper: SidebarProvider,
    });
    expect(r2.current.width).toBe(DEFAULT_SIDEBAR_WIDTH);
    expect(r2.current.collapsed).toBe(false);
  });

  it("toggles mobile drawer state", () => {
    const { result } = renderHook(() => useSidebar(), {
      wrapper: SidebarProvider,
    });

    expect(result.current.mobileOpen).toBe(false);
    act(() => {
      result.current.toggleMobileOpen();
    });
    expect(result.current.mobileOpen).toBe(true);
    act(() => {
      result.current.setMobileOpen(false);
    });
    expect(result.current.mobileOpen).toBe(false);
  });
});
