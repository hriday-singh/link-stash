import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FilterBar } from "@/features/search/FilterBar";
import { parseCardFilters, type CardFilters } from "@/features/search/filters";
import { useCards } from "@/features/feed/useCards";
import { VirtualGrid } from "@/components/VirtualGrid";
import { categoryColorVar } from "@/lib/categories";

export const Route = createFileRoute("/category/$name")({
  validateSearch: (search: Record<string, unknown>): CardFilters => parseCardFilters(search),
  component: CategoryPage,
});

function CategoryPage() {
  const { name } = Route.useParams();
  const searchFilters = Route.useSearch();
  const navigate = useNavigate({ from: "/category/$name" });

  const effectiveFilters: CardFilters = {
    ...searchFilters,
    category: name,
  };

  const { items, hasNextPage, isFetchingNextPage, fetchNextPage } = useCards(effectiveFilters);

  const handleFilterChange = (nextFilters: CardFilters) => {
    navigate({
      search: {
        ...nextFilters,
        category: name,
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-4 flex items-center gap-2.5">
        <span
          aria-hidden
          className="size-3.5 rounded-full"
          style={{ background: categoryColorVar(`cat-${name}`) }}
        />
        <h1 className="text-xl font-bold tracking-tight text-foreground capitalize sm:text-2xl">
          {name}
        </h1>
      </div>

      <FilterBar filters={effectiveFilters} onChange={handleFilterChange} hideCategory />

      <div className="mt-4">
        <VirtualGrid
          items={items}
          groupByDay
          hasMore={hasNextPage}
          isLoadingMore={isFetchingNextPage}
          onLoadMore={fetchNextPage}
          emptyMessage={`No cards in "${name}" yet.`}
          emptySubtext="Use /stash in Claude or agy to categorize items."
        />
      </div>
    </div>
  );
}
