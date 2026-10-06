import * as React from "react";
import Sigma from "sigma";
import Graph from "graphology";
import FA2LayoutSupervisor from "graphology-layout-forceatlas2/worker";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ZoomInAreaIcon,
  ZoomOutAreaIcon,
  RefreshIcon,
  InformationCircleIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";

import type { GraphData } from "@/api/client";
import { useTheme } from "@/state/theme";
import { toGraphology } from "./toGraphology";
import { resolveCategoryColor, resolveEdgeColor } from "./colorResolver";
import { Button } from "@/components/ui/button";

export interface HoveredNodeInfo {
  id: string;
  label: string;
  category: string;
  kind: string;
  nodeType: "card" | "source" | "creator";
}

export interface GraphViewProps {
  graphData: GraphData;
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string, nodeType: "card" | "source" | "creator") => void;
  className?: string;
  height?: string | number;
  emptyMessage?: string;
  showControls?: boolean;
}

export function GraphView({
  graphData,
  selectedNodeId,
  onSelectNode,
  className = "",
  height = "100%",
  emptyMessage = "No graph data available",
  showControls = true,
}: GraphViewProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const rendererRef = React.useRef<Sigma | null>(null);
  const supervisorRef = React.useRef<FA2LayoutSupervisor | null>(null);
  const graphRef = React.useRef<Graph | null>(null);

  const [hoveredNode, setHoveredNode] = React.useState<HoveredNodeInfo | null>(null);
  const [initError, setInitError] = React.useState<string | null>(null);

  // Safely consume theme if inside ThemeProvider, else default to light
  let resolvedTheme = "light";
  try {
    const themeCtx = useTheme();
    resolvedTheme = themeCtx.resolved;
  } catch {
    // Graceful fallback outside provider (e.g. in standalone tests)
  }

  const nodes = graphData.nodes ?? [];
  const edges = graphData.edges ?? [];
  const isIsolatedCard = nodes.length === 1 && edges.length === 0;

  // 1. Initialize Sigma and FA2 Web Worker supervisor
  React.useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;

    try {
      const graph = toGraphology(graphData);
      graphRef.current = graph;

      // Sigma WebGL instance
      const renderer = new Sigma(graph, containerRef.current, {
        labelFont: "Geist Variable, sans-serif",
        labelSize: 11,
        labelWeight: "500",
        renderEdgeLabels: false,
        enableEdgeEvents: false,
        allowInvalidContainer: true,
        stagePadding: 30,
        nodeProgramClasses: {},
        nodeReducer: (node, data) => {
          if (selectedNodeId && node === selectedNodeId) {
            return {
              ...data,
              highlighted: true,
              size: (data.size || 6) * 1.3,
            };
          }
          return data;
        },
      });
      rendererRef.current = renderer;

      // ForceAtlas2 Web Worker supervisor
      const supervisor = new FA2LayoutSupervisor(graph, {
        settings: {
          barnesHutOptimize: nodes.length > 50,
          strongGravityMode: false,
          gravity: 1.2,
          scalingRatio: 10,
          slowDown: 1.5,
        },
      });
      supervisorRef.current = supervisor;
      supervisor.start();

      // Time budget: stop worker after 2.0s to free background CPU
      const budgetTimer = setTimeout(() => {
        if (supervisor.isRunning()) {
          supervisor.stop();
        }
      }, 2000);

      // Event listeners
      renderer.on("enterNode", ({ node }) => {
        if (!graph.hasNode(node)) return;
        const attrs = graph.getNodeAttributes(node);
        setHoveredNode({
          id: node,
          label: String(attrs.label || node),
          category: String(attrs.category || ""),
          kind: String(attrs.kind || ""),
          nodeType: attrs.nodeType as "card" | "source" | "creator",
        });
      });

      renderer.on("leaveNode", () => {
        setHoveredNode(null);
      });

      renderer.on("clickNode", ({ node }) => {
        if (!graph.hasNode(node)) return;
        const attrs = graph.getNodeAttributes(node);
        onSelectNode?.(node, attrs.nodeType as "card" | "source" | "creator");
      });

      // Cleanup on unmount or re-render
      return () => {
        clearTimeout(budgetTimer);
        if (supervisor) {
          if (supervisor.isRunning()) supervisor.stop();
          supervisor.kill();
        }
        supervisorRef.current = null;
        if (renderer) {
          renderer.kill();
        }
        rendererRef.current = null;
        graphRef.current = null;
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to initialize graph view";
      queueMicrotask(() => {
        setInitError(msg);
      });
    }
  }, [graphData, onSelectNode, nodes.length, selectedNodeId]);

  // 2. React to theme changes: update node & edge colors from computed tokens
  React.useEffect(() => {
    if (!graphRef.current || !rendererRef.current) return;
    const graph = graphRef.current;
    graph.forEachNode((node, attrs) => {
      graph.setNodeAttribute(node, "color", resolveCategoryColor(String(attrs.category || "")));
    });
    graph.forEachEdge((edge, attrs) => {
      graph.setEdgeAttribute(edge, "color", resolveEdgeColor(String(attrs.type || "")));
    });
    rendererRef.current.refresh();
  }, [resolvedTheme]);

  // Zoom controls
  const handleZoomIn = () => {
    rendererRef.current?.getCamera().animatedZoom({ factor: 1.5 });
  };
  const handleZoomOut = () => {
    rendererRef.current?.getCamera().animatedZoom({ factor: 1 / 1.5 });
  };
  const handleReset = () => {
    rendererRef.current?.getCamera().animatedReset();
  };

  if (nodes.length === 0) {
    return (
      <div
        data-testid="graph-empty"
        data-lenis-prevent
        className={`flex items-center justify-center rounded-xl border border-dashed border-border bg-surface-sunken/40 p-8 text-center text-xs text-muted-foreground ${className}`}
        style={{ height }}
      >
        <div className="flex flex-col items-center gap-2">
          <HugeiconsIcon icon={InformationCircleIcon} className="size-5 opacity-60" strokeWidth={1.5} />
          <span>{emptyMessage}</span>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div
        data-testid="graph-error"
        data-lenis-prevent
        className={`flex items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-xs text-destructive ${className}`}
        style={{ height }}
      >
        <span>{initError}</span>
      </div>
    );
  }

  return (
    <div
      data-testid="graph-container"
      data-lenis-prevent
      className={`relative w-full overflow-hidden rounded-xl border border-border/70 bg-surface-sunken/50 ${className}`}
      style={{ height }}
    >
      {/* Canvas container for Sigma WebGL */}
      <div
        ref={containerRef}
        data-testid="sigma-canvas"
        className="size-full cursor-grab active:cursor-grabbing"
      />

      {/* Isolated card notice: Review Focus #2 */}
      {isIsolatedCard && (
        <div
          data-testid="isolated-notice"
          className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-full border border-border/80 bg-background/90 px-2.5 py-1 text-2xs font-medium text-muted-foreground shadow-xs backdrop-blur-xs"
        >
          <span className="size-1.5 rounded-full bg-muted-foreground/60" />
          <span>No connections yet</span>
        </div>
      )}

      {/* Hover preview tooltip */}
      {hoveredNode && (
        <div
          data-testid="graph-tooltip"
          className="pointer-events-none absolute top-3 left-3 z-20 flex max-w-xs items-center gap-2.5 rounded-lg border border-border/80 bg-background/95 p-2 shadow-md backdrop-blur-xs text-xs"
        >
          {hoveredNode.nodeType === "source" ? (
            <div className="relative size-9 shrink-0 overflow-hidden rounded border border-border/60 bg-muted flex items-center justify-center">
              <img
                src={`/api/sources/${hoveredNode.id}/thumb`}
                alt=""
                className="size-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <HugeiconsIcon icon={Video01Icon} className="size-4 text-muted-foreground" strokeWidth={1.5} />
            </div>
          ) : (
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: resolveCategoryColor(hoveredNode.category) }}
            />
          )}
          <div className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-foreground">
              {hoveredNode.label}
            </span>
            <span className="block truncate font-mono text-[10px] text-muted-foreground">
              {hoveredNode.nodeType} · {hoveredNode.category || hoveredNode.kind}
            </span>
          </div>
        </div>
      )}

      {/* Zoom and Navigation Controls */}
      {showControls && (
        <div
          data-testid="graph-controls"
          className="absolute right-3 bottom-3 z-10 flex items-center gap-1 rounded-lg border border-border/80 bg-background/90 p-1 shadow-xs backdrop-blur-xs"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            className="size-7 p-0"
            aria-label="Zoom in"
          >
            <HugeiconsIcon icon={ZoomInAreaIcon} className="size-3.5" strokeWidth={1.5} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            className="size-7 p-0"
            aria-label="Zoom out"
          >
            <HugeiconsIcon icon={ZoomOutAreaIcon} className="size-3.5" strokeWidth={1.5} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="size-7 p-0"
            aria-label="Reset zoom"
          >
            <HugeiconsIcon icon={RefreshIcon} className="size-3.5" strokeWidth={1.5} />
          </Button>
        </div>
      )}
    </div>
  );
}
