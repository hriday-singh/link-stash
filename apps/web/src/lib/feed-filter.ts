import type { TileData } from "@/components/Tile";

export interface FeedDay {
  label: string;
  /** Days before today; drives the date-range filter. */
  ageDays: number;
  tiles: TileData[];
}

export interface FeedFilters {
  kinds: readonly string[];
  categories: readonly string[];
  platforms: readonly string[];
  /** null = all time. */
  maxAgeDays: number | null;
}

export const EMPTY_FILTERS: FeedFilters = {
  kinds: [],
  categories: [],
  platforms: [],
  maxAgeDays: null,
};

export function activeFilterCount(f: FeedFilters): number {
  return (
    f.kinds.length + f.categories.length + f.platforms.length + (f.maxAgeDays === null ? 0 : 1)
  );
}

/** Empty list in a facet = no restriction. Query matches title, key or category. Empty days are dropped. */
export function filterFeed(days: readonly FeedDay[], f: FeedFilters, query: string): FeedDay[] {
  const q = query.trim().toLowerCase();
  const keep = (t: TileData) =>
    (f.kinds.length === 0 || f.kinds.includes(t.kind)) &&
    (f.categories.length === 0 || f.categories.includes(t.category)) &&
    (f.platforms.length === 0 || (t.platform !== null && f.platforms.includes(t.platform))) &&
    (q === "" || [t.title, t.key, t.category].some((s) => s.toLowerCase().includes(q)));

  return days
    .filter((d) => f.maxAgeDays === null || d.ageDays <= f.maxAgeDays)
    .map((d) => ({ ...d, tiles: d.tiles.filter(keep) }))
    .filter((d) => d.tiles.length > 0);
}
