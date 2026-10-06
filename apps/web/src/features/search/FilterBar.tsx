import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  FilterIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { api, unwrap } from "@/api/client";
import { queryKeys } from "@/api/keys";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VALID_KINDS, type CardFilters, type CardKind } from "./filters";

interface FilterBarProps {
  filters: CardFilters;
  onChange: (filters: CardFilters) => void;
  hideCategory?: boolean;
}

export function FilterBar({ filters, onChange, hideCategory = false }: FilterBarProps) {
  const { data: meta } = useQuery({
    queryKey: queryKeys.meta(),
    queryFn: () => unwrap(api.GET("/api/meta")),
    staleTime: 1000 * 60,
  });

  const categories = meta?.categories?.map((c) => c.name) ?? [];

  const hasActiveFilters = Boolean(
    filters.kind ||
      (!hideCategory && filters.category) ||
      filters.tag ||
      filters.creator ||
      filters.since ||
      filters.until ||
      filters.has_video,
  );

  const clearAll = () => {
    onChange({
      category: hideCategory ? filters.category : undefined,
      q: filters.q,
    });
  };

  return (
    <div
      data-slot="filter-bar"
      className="flex flex-wrap items-center gap-2 border-b bg-background/50 py-2.5 backdrop-blur-xs"
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <HugeiconsIcon icon={FilterIcon} className="size-3.5" strokeWidth={1.5} />
        <span>Filters</span>
      </div>

      {/* Kind Select */}
      <div className="w-32">
        <Select
          value={filters.kind ?? "all"}
          onValueChange={(val) =>
            onChange({
              ...filters,
              kind: val === "all" ? undefined : (val as CardKind),
            })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All kinds" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            {VALID_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {kind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category Select (unless in category-specific view) */}
      {!hideCategory && (
        <div className="w-36">
          <Select
            value={filters.category ?? "all"}
            onValueChange={(val) =>
              onChange({
                ...filters,
                category: val === "all" ? undefined : val,
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Video Only Toggle */}
      <Button
        variant={filters.has_video ? "secondary" : "outline"}
        size="sm"
        onClick={() =>
          onChange({
            ...filters,
            has_video: filters.has_video ? undefined : true,
          })
        }
        className={`h-8 gap-1.5 text-xs ${
          filters.has_video ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
        }`}
      >
        <HugeiconsIcon icon={Video01Icon} className="size-3.5" strokeWidth={1.5} />
        <span>Has video</span>
      </Button>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" strokeWidth={1.5} />
          <span>Clear all</span>
        </Button>
      )}
    </div>
  );
}
