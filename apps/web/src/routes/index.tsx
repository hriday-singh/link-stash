import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FilterBar } from "@/features/search/FilterBar";
import { parseCardFilters, type CardFilters } from "@/features/search/filters";
import { useCards } from "@/features/feed/useCards";
import { VirtualGrid } from "@/components/VirtualGrid";
import { useUntriagedHint } from "@/lib/useMeta";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): CardFilters => parseCardFilters(search),
  component: FeedPage,
});

function FeedPage() {
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const { items, hasNextPage, isFetchingNextPage, fetchNextPage } = useCards(filters);
  const untriaged = useUntriagedHint();

  const handleFilterChange = (nextFilters: CardFilters) => {
    navigate({
      search: nextFilters,
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-4 flex flex-col gap-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Feed</h1>
        <p className="text-xs text-muted-foreground">
          Newest saved links, models, and tools from your stash.
        </p>
      </div>

      <FilterBar filters={filters} onChange={handleFilterChange} />

      <div className="mt-4">
        <VirtualGrid
          items={items}
          groupByDay
          hasMore={hasNextPage}
          isLoadingMore={isFetchingNextPage}
          onLoadMore={fetchNextPage}
          emptyMessage={untriaged?.message ?? "Paste links into /stash in Claude Code or agy."}
          emptySubtext={
            untriaged?.subtext ??
            "As soon as you extract and triage reels or links, they will appear here."
          }
        />
      </div>
    </div>
  );
}
