import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Clock01Icon,
  GitForkIcon,
  LayoutGridIcon,
  PackageIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "cn";
import { AddCategoryDialog } from "@/components/AddCategoryDialog";
import { FeedFiltersPopover } from "@/components/FeedFiltersPopover";
import { PageHeader } from "@/components/PageHeader";
import { Tile } from "@/components/Tile";
import { Button } from "@/components/ui/button";
import { categoryColorVar } from "@/lib/categories";
import { EMPTY_FILTERS, filterFeed, type FeedDay, type FeedFilters } from "@/lib/feed-filter";
import { MOCK_PLATFORMS, type Category } from "./mock-data";

interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly icon: typeof LayoutGridIcon;
  readonly count?: number;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: "feed", label: "Feed", icon: LayoutGridIcon },
  { id: "sources", label: "Sources", icon: Video01Icon },
  { id: "pending", label: "Pending", icon: Clock01Icon, count: 3 },
  { id: "rejected", label: "Rejected", icon: Cancel01Icon },
  { id: "inventory", label: "Inventory", icon: PackageIcon },
  { id: "graph", label: "Graph", icon: GitForkIcon },
];

const ROW =
  "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-xs transition-colors duration-(--duration-fast)";
const SECTION_LABEL = "text-2xs font-semibold tracking-wider text-muted-foreground uppercase";

export interface MockSidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  categories: readonly Category[];
  onAddCategory: (category: { name: string; color: string }) => void;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  mobileOpen: boolean;
  onClose: () => void;
}

export function MockSidebar({
  currentView,
  onSelectView,
  categories,
  onAddCategory,
  selectedCategory,
  onSelectCategory,
  mobileOpen,
  onClose,
}: MockSidebarProps) {
  const content = (
    <nav aria-label="Library" className="flex h-full flex-col gap-6 overflow-y-auto p-3">
      <div className="flex flex-col gap-0.5">
        <span className={cn(SECTION_LABEL, "px-2.5 pb-2")}>Library</span>
        {NAV_ITEMS.map((item) => {
          const isActive = currentView === item.id && !selectedCategory;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={isActive ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                onSelectView(item.id);
                onClose();
              }}
              className={cn(
                ROW,
                "font-medium",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <HugeiconsIcon
                icon={item.icon}
                className="size-4 shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              <span className="flex-1 truncate">{item.label}</span>
              {item.count !== undefined && (
                <span className="rounded-full bg-primary/10 px-1.5 font-mono text-2xs text-primary">
                  {item.count}
                </span>
              )}
            </a>
          );
        })}
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between pr-1 pb-1 pl-2.5">
          <span className={SECTION_LABEL}>Categories</span>
          <AddCategoryDialog existing={categories.map((c) => c.name)} onAdd={onAddCategory} />
        </div>
        {categories.map((c) => {
          const isSelected = selectedCategory === c.name;
          return (
            <a
              key={c.name}
              href={`#cat-${c.name}`}
              aria-current={isSelected ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                onSelectCategory(isSelected ? null : c.name);
                onClose();
              }}
              className={cn(
                ROW,
                isSelected
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: categoryColorVar(c.color) }}
              />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {c.count}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );

  return (
    <>
      <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 border-r bg-sidebar-bg lg:block">
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-x-0 top-14 bottom-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/20" onClick={onClose} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r bg-sidebar-bg shadow-md">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}

export interface MockFeedProps {
  days: readonly FeedDay[];
  categories: readonly Category[];
  query: string;
  selectedCategory?: string | null;
  onClearCategory?: () => void;
  onOpenCard?: (slug: string) => void;
}

export function MockFeed({
  days,
  categories,
  query,
  selectedCategory,
  onClearCategory,
  onOpenCard,
}: MockFeedProps) {
  const [filters, setFilters] = useState<FeedFilters>(EMPTY_FILTERS);
  const effective = selectedCategory ? { ...filters, categories: [selectedCategory] } : filters;
  const visible = filterFeed(days, effective, query);
  const total = visible.reduce((n, d) => n + d.tiles.length, 0);
  const kinds = [...new Set(days.flatMap((d) => d.tiles.map((t) => t.kind)))];
  const hasNarrowing = total !== days.reduce((n, d) => n + d.tiles.length, 0);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={selectedCategory ?? "Feed"}
        description={
          query ? `${total} results for "${query}"` : `${total} card${total === 1 ? "" : "s"}`
        }
        actions={
          <>
            {selectedCategory && (
              <Button variant="ghost" size="lg" className="text-xs" onClick={onClearCategory}>
                <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" strokeWidth={1.5} />
                All categories
              </Button>
            )}
            <FeedFiltersPopover
              value={filters}
              onChange={setFilters}
              kinds={kinds}
              categories={selectedCategory ? [] : categories.map((c) => c.name)}
              platforms={MOCK_PLATFORMS}
            />
          </>
        }
      />

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm font-medium">No cards match.</p>
          <p className="text-xs text-muted-foreground">
            Try a different search or clear the filters.
          </p>
          {hasNarrowing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                onClearCategory?.();
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        visible.map((day) => (
          <section
            key={day.label}
            aria-labelledby={`day-${day.ageDays}`}
            className="flex flex-col gap-4"
          >
            <div className="flex items-baseline justify-between">
              <h2
                id={`day-${day.ageDays}`}
                className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
              >
                {day.label}
              </h2>
              <span className="text-2xs text-muted-foreground">
                {day.tiles.length} item{day.tiles.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-4">
              {day.tiles.map((tile) => (
                <div
                  key={tile.slug}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${tile.title}`}
                  onClick={() => onOpenCard?.(tile.slug)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenCard?.(tile.slug);
                    }
                  }}
                  className="h-full cursor-pointer rounded-lg"
                >
                  <Tile data={tile} />
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
