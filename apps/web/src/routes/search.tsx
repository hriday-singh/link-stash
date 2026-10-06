import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import { queryKeys } from "@/api/keys";
import { VirtualGrid } from "@/components/VirtualGrid";
import { Input } from "@/components/ui/input";
import { parseCardFilters, type CardFilters } from "@/features/search/filters";
import { getCategoryToken } from "@/lib/categories";
import type { Kind } from "@/lib/kinds";
import type { TileData } from "@/components/Tile";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): CardFilters => parseCardFilters(search),
  component: SearchPage,
});

function SearchPage() {
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const query = filters.q ?? "";

  const { data: hits, isLoading } = useQuery({
    queryKey: queryKeys.search(query),
    queryFn: () =>
      unwrap(
        api.GET("/api/search", {
          params: { query: { q: query, limit: 100 } },
        }),
      ),
    enabled: query.trim().length > 0,
    staleTime: 1000 * 30,
  });

  const items: (TileData & { added?: string })[] =
    hits?.map((hit) => ({
      slug: hit.slug,
      key: hit.slug,
      title: hit.title,
      category: hit.category,
      categoryColor: getCategoryToken(hit.category),
      kind: hit.kind as Kind,
      thumbUrl: null,
      platform: null,
    })) ?? [];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-col gap-3">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Search Results
        </h1>
        <div className="max-w-md">
          <Input
            value={query}
            onChange={(e) =>
              navigate({
                search: {
                  ...filters,
                  q: e.target.value,
                },
              })
            }
            placeholder="Search titles, bodies, and tags…"
            className="h-9 text-xs"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-xs text-muted-foreground">Searching…</div>
      ) : query.trim() ? (
        <VirtualGrid
          items={items}
          groupByDay={false}
          emptyMessage={`No matching cards found for "${query}".`}
          emptySubtext="Try adjusting your search query or removing filters."
        />
      ) : (
        <div className="flex min-h-[30vh] flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
          Enter a search query above or press Ctrl+K to search your library.
        </div>
      )}
    </div>
  );
}
