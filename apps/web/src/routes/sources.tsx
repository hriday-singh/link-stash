import { createFileRoute } from "@tanstack/react-router";
import { parseSourceFilters, type SourceFilters } from "@/features/sources/filters";
import { SourcesPage } from "@/features/sources/SourcesPage";

export const Route = createFileRoute("/sources")({
  validateSearch: (search: Record<string, unknown>): SourceFilters =>
    parseSourceFilters(search),
  component: RouteComponent,
});

function RouteComponent() {
  const filters = Route.useSearch();
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
      <SourcesPage filters={filters} />
    </div>
  );
}
