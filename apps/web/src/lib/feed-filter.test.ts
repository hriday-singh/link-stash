import type { TileData } from "@/components/Tile";
import { activeFilterCount, EMPTY_FILTERS, filterFeed, type FeedDay } from "./feed-filter";

const tile = (slug: string, over: Partial<TileData> = {}): TileData => ({
  slug,
  key: `github:owner/${slug}`,
  title: slug,
  category: "repos-tools",
  categoryColor: "cat-repos-tools",
  kind: "repo",
  thumbUrl: null,
  platform: "instagram",
  ...over,
});

const days: FeedDay[] = [
  {
    label: "Today",
    ageDays: 0,
    tiles: [tile("a"), tile("b", { kind: "model", category: "models", platform: "youtube" })],
  },
  { label: "Last week", ageDays: 6, tiles: [tile("c", { title: "Scrapling" })] },
];

const slugs = (out: FeedDay[]) => out.flatMap((d) => d.tiles.map((t) => t.slug));

it("returns everything with no filters", () => {
  expect(slugs(filterFeed(days, EMPTY_FILTERS, ""))).toEqual(["a", "b", "c"]);
});

it("filters by each facet and drops empty days", () => {
  expect(slugs(filterFeed(days, { ...EMPTY_FILTERS, kinds: ["model"] }, ""))).toEqual(["b"]);
  expect(slugs(filterFeed(days, { ...EMPTY_FILTERS, categories: ["models"] }, ""))).toEqual(["b"]);
  expect(slugs(filterFeed(days, { ...EMPTY_FILTERS, platforms: ["youtube"] }, ""))).toEqual(["b"]);
  const recent = filterFeed(days, { ...EMPTY_FILTERS, maxAgeDays: 1 }, "");
  expect(recent.map((d) => d.label)).toEqual(["Today"]);
});

it("matches the query case-insensitively against title, key and category", () => {
  expect(slugs(filterFeed(days, EMPTY_FILTERS, "scrap"))).toEqual(["c"]);
  expect(slugs(filterFeed(days, EMPTY_FILTERS, "OWNER/B"))).toEqual(["b"]);
  expect(slugs(filterFeed(days, EMPTY_FILTERS, "models"))).toEqual(["b"]);
});

it("counts active filters", () => {
  expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
  expect(
    activeFilterCount({ kinds: ["repo"], categories: ["a", "b"], platforms: [], maxAgeDays: 7 }),
  ).toBe(4);
});
