import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Share08Icon } from "@hugeicons/core-free-icons";

import { api, unwrap } from "@/api/client";
import { queryKeys } from "@/api/keys";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { GraphView } from "./GraphView";

export interface LocalGraphProps {
  slug: string;
  className?: string;
}

export function LocalGraph({ slug, className = "" }: LocalGraphProps) {
  const navigate = useNavigate();
  const [depth, setDepth] = React.useState<1 | 2>(1);

  const { data: graphData, isLoading } = useQuery({
    queryKey: queryKeys.graph({ center: slug, depth }),
    queryFn: async () => {
      return await unwrap(
        api.GET("/api/graph", {
          params: {
            query: {
              center: slug,
              depth,
            },
          },
        }),
      );
    },
    enabled: Boolean(slug),
  });

  const handleSelectNode = (nodeId: string, nodeType: "card" | "source" | "creator") => {
    if (nodeType === "card") {
      if (nodeId !== slug) {
        navigate({ to: "/c/$slug", params: { slug: nodeId } });
      }
    } else if (nodeType === "source") {
      navigate({ to: "/s/$sourceId", params: { sourceId: nodeId } });
    } else if (nodeType === "creator") {
      const creator = nodeId.replace(/^creator:/, "");
      navigate({ to: "/sources", search: { creator } });
    }
  };

  const nodeCount = graphData?.nodes?.length ?? 0;

  return (
    <div
      data-testid="local-graph"
      className={`space-y-3 rounded-xl border border-border/70 bg-card p-3 shadow-xs text-xs ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <HugeiconsIcon icon={Share08Icon} className="size-3.5 text-primary" strokeWidth={1.5} />
          <span className="text-2xs uppercase tracking-wider text-muted-foreground">
            Neighborhood
          </span>
          {nodeCount > 0 && (
            <span
              data-testid="node-count-badge"
              className="rounded-full bg-muted/60 px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground"
            >
              {nodeCount}
            </span>
          )}
        </div>

        {/* Depth 1-hop vs 2-hop toggle */}
        <SegmentedControl
          value={String(depth)}
          onChange={(val) => setDepth(Number(val) as 1 | 2)}
          options={[
            { value: "1", label: "1 hop" },
            { value: "2", label: "2 hops" },
          ]}
          aria-label="Graph exploration depth"
        />
      </div>

      {isLoading ? (
        <div
          data-testid="local-graph-loading"
          className="flex h-52 w-full items-center justify-center rounded-lg border border-border/50 bg-surface-sunken/40 animate-pulse text-2xs text-muted-foreground"
        >
          Loading neighborhood...
        </div>
      ) : (
        <GraphView
          graphData={graphData ?? { nodes: [], edges: [] }}
          selectedNodeId={slug}
          onSelectNode={handleSelectNode}
          height={208}
          emptyMessage="No connections yet"
          showControls={false}
          className="rounded-lg"
        />
      )}
    </div>
  );
}
