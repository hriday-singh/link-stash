import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { cn } from "cn";

export interface ChipInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ChipInput({
  value = [],
  onChange,
  suggestions = [],
  placeholder = "Add tag…",
  disabled = false,
  className,
}: ChipInputProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const trimmed = inputValue.trim().toLowerCase();

  // Filter suggestions not already present in value
  const filteredSuggestions = React.useMemo(() => {
    if (!trimmed) return [];
    return suggestions
      .filter((s) => s.toLowerCase().includes(trimmed) && !value.includes(s))
      .slice(0, 8);
  }, [suggestions, trimmed, value]);

  const addChip = (chip: string) => {
    const clean = chip.trim();
    if (!clean || value.includes(clean)) {
      setInputValue("");
      setIsOpen(false);
      return;
    }
    onChange([...value, clean]);
    setInputValue("");
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const removeChip = (indexToRemove: number) => {
    onChange(value.filter((_, i) => i !== indexToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (isOpen && selectedIndex >= 0 && filteredSuggestions[selectedIndex]) {
        addChip(filteredSuggestions[selectedIndex]);
      } else if (inputValue.trim()) {
        addChip(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      e.preventDefault();
      removeChip(value.length - 1);
    } else if (e.key === "ArrowDown" && isOpen && filteredSuggestions.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp" && isOpen && filteredSuggestions.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface-sunken p-1.5 text-xs text-foreground transition-colors focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-ring",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((chip, index) => (
        <span
          key={`${chip}-${index}`}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground select-none"
        >
          <span>{chip}</span>
          {!disabled && (
            <button
              type="button"
              aria-label={`Remove tag ${chip}`}
              onClick={(e) => {
                e.stopPropagation();
                removeChip(index);
              }}
              className="text-muted-foreground hover:text-foreground transition-colors focus:outline-hidden"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3" strokeWidth={2} />
            </button>
          )}
        </span>
      ))}

      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        value={inputValue}
        placeholder={placeholder}
        onChange={(e) => {
          setInputValue(e.target.value);
          setIsOpen(true);
          setSelectedIndex(-1);
        }}
        onFocus={() => {
          if (filteredSuggestions.length > 0) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className="flex-1 min-w-[70px] bg-transparent px-1 py-0.5 text-xs text-foreground placeholder:text-muted-foreground outline-hidden"
      />

      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
          {filteredSuggestions.map((suggestion, idx) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                addChip(suggestion);
              }}
              className={cn(
                "flex w-full items-center px-2 py-1.5 text-left text-xs rounded-md transition-colors",
                idx === selectedIndex
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
