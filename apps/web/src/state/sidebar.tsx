import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const MIN_SIDEBAR_WIDTH = 200;
export const MAX_SIDEBAR_WIDTH = 400;
export const DEFAULT_SIDEBAR_WIDTH = 256;

const STORAGE_KEY = "stash:sidebar:state";

interface StoredSidebarState {
  width: number;
  collapsed: boolean;
}

function clampWidth(w: number): number {
  if (typeof w !== "number" || Number.isNaN(w)) return DEFAULT_SIDEBAR_WIDTH;
  return Math.min(Math.max(w, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
}

function loadInitialState(): StoredSidebarState {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return { width: DEFAULT_SIDEBAR_WIDTH, collapsed: false };
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { width: DEFAULT_SIDEBAR_WIDTH, collapsed: false };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const width = typeof parsed.width === "number" ? clampWidth(parsed.width) : DEFAULT_SIDEBAR_WIDTH;
    const collapsed = typeof parsed.collapsed === "boolean" ? parsed.collapsed : false;
    return { width, collapsed };
  } catch {
    return { width: DEFAULT_SIDEBAR_WIDTH, collapsed: false };
  }
}

function persistState(state: StoredSidebarState) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Gracefully ignore storage write failures (e.g., quota exceeded or privacy mode)
  }
}

interface SidebarContextValue {
  width: number;
  collapsed: boolean;
  mobileOpen: boolean;
  setWidth: (width: number) => void;
  setCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  toggleCollapsed: () => void;
  setMobileOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toggleMobileOpen: () => void;
  startResizing: (e: React.MouseEvent) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: Partial<StoredSidebarState>;
}) {
  const [persisted, setPersisted] = useState<StoredSidebarState>(() => {
    const loaded = loadInitialState();
    return {
      width: clampWidth(initialState?.width ?? loaded.width),
      collapsed: initialState?.collapsed ?? loaded.collapsed,
    };
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  const setWidth = useCallback((newWidth: number) => {
    setPersisted((prev) => {
      const next = { ...prev, width: clampWidth(newWidth) };
      persistState(next);
      return next;
    });
  }, []);

  const setCollapsed = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setPersisted((prev) => {
      const nextVal = typeof value === "function" ? value(prev.collapsed) : value;
      const next = { ...prev, collapsed: nextVal };
      persistState(next);
      return next;
    });
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => !c);
  }, [setCollapsed]);

  const toggleMobileOpen = useCallback(() => {
    setMobileOpen((o) => !o);
  }, []);

  // Drag-to-resize handle logic
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const initialWidth = persisted.width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setWidth(initialWidth + deltaX);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [persisted.width, setWidth]);

  const contextValue = useMemo<SidebarContextValue>(
    () => ({
      width: persisted.width,
      collapsed: persisted.collapsed,
      mobileOpen,
      setWidth,
      setCollapsed,
      toggleCollapsed,
      setMobileOpen,
      toggleMobileOpen,
      startResizing,
    }),
    [
      persisted.width,
      persisted.collapsed,
      mobileOpen,
      setWidth,
      setCollapsed,
      toggleCollapsed,
      toggleMobileOpen,
      startResizing,
    ],
  );

  return <SidebarContext.Provider value={contextValue}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
