import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GlobalGraph } from "@/features/graph/GlobalGraph";
import { parseGraphSearch, type GraphSearchFilters } from "@/features/graph/types";

export const Route = createFileRoute("/graph")({
  validateSearch: parseGraphSearch,
  component: GraphRoutePage,
});

function GraphRoutePage() {
  const navigate = useNavigate();
  const filters = Route.useSearch();

  const handleFilterChange = (nextFilters: GraphSearchFilters) => {
    navigate({
      to: "/graph",
      search: nextFilters,
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
      <GlobalGraph filters={filters} onFilterChange={handleFilterChange} />
    </div>
  );
}
