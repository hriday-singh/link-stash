import type { ReactNode } from "react";
import { cn } from "cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  className?: string;
  size?: "sm" | "default";
  "aria-label"?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "sm",
  "aria-label": ariaLabel = "View switcher",
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center rounded-lg border border-border/60 bg-muted/50 p-0.5 text-muted-foreground transition-colors",
        className,
      )}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isSelected}
            data-state={isSelected ? "active" : "inactive"}
            onClick={() => onChange(opt.value)}
            className={cn(
              "group relative inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all duration-(--duration-base) outline-none select-none",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              isSelected
                ? "bg-background text-foreground shadow-pill ring-1 ring-border/50 font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40 active:translate-y-px",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            )}
          >
            {opt.icon && (
              <span
                className={cn(
                  "shrink-0 transition-transform duration-(--duration-fast)",
                  isSelected
                    ? "text-foreground"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
                aria-hidden="true"
              >
                {opt.icon}
              </span>
            )}
            <span>{opt.label}</span>
            {opt.badge && <span className="ml-0.5">{opt.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
