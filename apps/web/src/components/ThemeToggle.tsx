import { Sun01Icon, Moon02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { MorphIcon } from "@/components/ui/MorphIcon";
import { useTheme } from "@/state/theme";
import { cn } from "cn";

export interface ThemeToggleProps {
  collapsed?: boolean;
  className?: string;
}

export function ThemeToggle({ collapsed = false, className }: ThemeToggleProps) {
  const { resolved, toggle } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "flex h-8 items-center gap-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
        collapsed ? "justify-center px-0" : "w-full justify-start px-2",
        className
      )}
    >
      <MorphIcon
        icon={resolved === "dark" ? Moon02Icon : Sun01Icon}
        size={14}
        strokeWidth={1.5}
        spring="snappy"
      />
      {!collapsed && (
        <span className="truncate">{resolved === "dark" ? "Dark mode" : "Light mode"}</span>
      )}
    </Button>
  );
}
