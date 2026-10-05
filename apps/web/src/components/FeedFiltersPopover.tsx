import { HugeiconsIcon } from "@hugeicons/react";
import { FilterIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { activeFilterCount, EMPTY_FILTERS, type FeedFilters } from "@/lib/feed-filter";

const DATE_RANGES: { label: string; value: number | null }[] = [
  { label: "All time", value: null },
  { label: "Today", value: 0 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
];

const CHIP =
  "font-normal aria-pressed:border-primary/50 aria-pressed:bg-primary/10 aria-pressed:text-primary";

function toggle(list: readonly string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Group({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: readonly string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Button
            key={o}
            variant="outline"
            size="xs"
            aria-pressed={selected.includes(o)}
            onClick={() => onToggle(o)}
            className={CHIP}
          >
            {o}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function FeedFiltersPopover({
  value,
  onChange,
  kinds,
  categories,
  platforms,
}: {
  value: FeedFilters;
  onChange: (next: FeedFilters) => void;
  kinds: readonly string[];
  categories: readonly string[];
  platforms: readonly string[];
}) {
  const count = activeFilterCount(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="lg" className="gap-1.5 text-xs">
          <HugeiconsIcon icon={FilterIcon} className="size-3.5" strokeWidth={1.5} />
          Filters
          {count > 0 && (
            <span className="rounded-full bg-primary px-1.5 font-mono text-2xs text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-4 p-4">
        <div role="group" aria-label="Date added" className="flex flex-col gap-1.5">
          <span className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
            Date added
          </span>
          <div className="flex flex-wrap gap-1.5">
            {DATE_RANGES.map((r) => (
              <Button
                key={r.label}
                variant="outline"
                size="xs"
                aria-pressed={value.maxAgeDays === r.value}
                onClick={() => onChange({ ...value, maxAgeDays: r.value })}
                className={CHIP}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
        <Group
          label="Kind"
          options={kinds}
          selected={value.kinds}
          onToggle={(v) => onChange({ ...value, kinds: toggle(value.kinds, v) })}
        />
        <Group
          label="Category"
          options={categories}
          selected={value.categories}
          onToggle={(v) => onChange({ ...value, categories: toggle(value.categories, v) })}
        />
        <Group
          label="Platform"
          options={platforms}
          selected={value.platforms}
          onToggle={(v) => onChange({ ...value, platforms: toggle(value.platforms, v) })}
        />
        <div className="flex justify-end border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={count === 0}
            onClick={() => onChange(EMPTY_FILTERS)}
          >
            Clear all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
