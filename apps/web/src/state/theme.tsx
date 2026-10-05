import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type Resolved = "light" | "dark";
interface ThemeValue {
  theme: Theme;
  resolved: Resolved;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const KEY = "stash.theme";
const QUERY = "(prefers-color-scheme: dark)";
const ThemeContext = createContext<ThemeValue | null>(null);

function readStored(): Theme {
  try {
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("theme");
      if (param === "light" || param === "dark") return param;
    }
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function writeStored(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // per-browser convenience only; the in-memory theme still applies
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: Resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const value = useMemo<ThemeValue>(() => {
    const setTheme = (next: Theme) => {
      writeStored(next);
      setThemeState(next);
    };
    return {
      theme,
      resolved,
      setTheme,
      toggle: () => setTheme(resolved === "dark" ? "light" : "dark"),
    };
  }, [theme, resolved]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
