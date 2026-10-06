import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Share08Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

import { api, unwrap } from "@/api/client";
import { queryKeys } from "@/api/keys";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { categoryColorVar } from "@/lib/categories";
import { useMeta, useUntriagedHint } from "@/lib/useMeta";
import { GraphView } from "./GraphView";
import type { GraphSearchFilters } from "./types";
export type { GraphSearchFilters };

export interface GlobalGraphProps {
  filters: GraphSearchFilters;
  onFilterChange: (filters: GraphSearchFilters) => void;
}

export function GlobalGraph({ filters, onFilterChange }: GlobalGraphProps) {
  const navigate = useNavigate();

  // 1. Fetch graph data with current filters
  const { data: graphData, isLoading } = useQuery({
    queryKey: queryKeys.graph({ category: filters.category, edge_type: filters.edge_type }),
    queryFn: async () => {
      return await unwrap(
        api.GET("/api/graph", {
          params: {
            query: {
              category: filters.category,
              edge_type: filters.edge_type,
            },
          },
        }),
      );
    },
  });

  // 2. Fetch categories metadata for legend and filter
  const { data: meta } = useMeta();
  const untriaged = useUntriagedHint();

  const categories = meta?.categories ?? [];
  const nodes = graphData?.nodes ?? [];
  const edges = graphData?.edges ?? [];

  const handleSelectNode = (nodeId: string, nodeType: "card" | "source" | "creator") => {
    if (nodeType === "card") {
      navigate({ to: "/c/$slug", params: { slug: nodeId } });
    } else if (nodeType === "source") {
      navigate({ to: "/s/$sourceId", params: { sourceId: nodeId } });
    } else if (nodeType === "creator") {
      const creator = nodeId.replace(/^creator:/, "");
      navigate({ to: "/sources", search: { creator } });
    }
  };

  const handleCategorySelect = (categoryName?: string) => {
    onFilterChange({
      ...filters,
      category: categoryName || undefined,
    });
  };

  const handleEdgeTypeSelect = (typeVal: string) => {
    onFilterChange({
      ...filters,
      edge_type: typeVal === "all" ? undefined : (typeVal as "wikilink" | "source" | "overlap"),
    });
  };

  const hasActiveFilters = Boolean(filters.category || filters.edge_type);

  return (
    <div data-testid="global-graph-page" className="flex flex-col gap-5">
      <PageHeader
        title="Global knowledge graph"
        description={`${nodes.length} nodes · ${edges.length} edges across cards, sources and creators`}
        actions={
          hasActiveFilters ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFilterChange({})}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" strokeWidth={1.5} />
              Reset filters
            </Button>
          ) : undefined
        }
      />

      {/* Filter and Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-xs text-xs">
        {/* Edge type segmented toggle */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
            Edges:
          </span>
          <SegmentedControl
            value={filters.edge_type ?? "all"}
            onChange={handleEdgeTypeSelect}
            options={[
              { value: "all", label: "All" },
              { value: "wikilink", label: "Wikilinks" },
              { value: "source", label: "Sources" },
              { value: "overlap", label: "Overlaps" },
            ]}
            aria-label="Edge type filter"
          />
        </div>

        {/* Category Pills Filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleCategorySelect(undefined)}
            className={`rounded-full px-2.5 py-1 text-2xs font-medium transition-colors ${
              !filters.category
                ? "bg-primary text-primary-foreground font-semibold"
                : "border border-border/70 bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            All categories
          </button>
          {categories.map((cat) => {
            const isSelected = filters.category === cat.name;
            return (
              <button
                key={cat.name}
                type="button"
                onClick={() => handleCategorySelect(isSelected ? undefined : cat.name)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "border border-border/70 bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span
                  className="size-1.5 rounded-full shrink-0"
                  style={{ background: categoryColorVar(cat.color) }}
                />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Graph Visualizer Canvas */}
      {isLoading ? (
        <div
          data-testid="global-graph-loading"
          className="flex h-[calc(100dvh-20rem)] min-h-96 w-full items-center justify-center rounded-xl border border-border/50 bg-surface-sunken/40 animate-pulse text-xs text-muted-foreground"
        >
          <div className="flex flex-col items-center gap-2">
            <HugeiconsIcon
              icon={Share08Icon}
              className="size-6 text-primary animate-spin"
              strokeWidth={1.5}
            />
            <span>Building global graph...</span>
          </div>
        </div>
      ) : (
        <GraphView
          graphData={graphData ?? { nodes: [], edges: [] }}
          onSelectNode={handleSelectNode}
          height="calc(100dvh - 20rem)"
          emptyMessage={
            untriaged
              ? `${untriaged.message}. ${untriaged.subtext}`
              : "No nodes match current filters"
          }
          className="min-h-96 shadow-xs"
        />
      )}
    </div>
  );
}
