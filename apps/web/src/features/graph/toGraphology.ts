import Graph from "graphology";
import type { GraphData, GraphNode, GraphEdge } from "@/api/client";
import { resolveCategoryColor, resolveEdgeColor as defaultResolveEdgeColor } from "./colorResolver";

export interface ToGraphologyOptions {
  resolveColor?: (category: string) => string;
  resolveEdgeColor?: (edgeType: string) => string;
}

export function toGraphology(data: GraphData, options: ToGraphologyOptions = {}): Graph {
  const graph = new Graph({ type: "directed", multi: false });
  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];

  const getColor = options.resolveColor ?? resolveCategoryColor;
  const getEdgeColor = options.resolveEdgeColor ?? defaultResolveEdgeColor;

  // 1. Add nodes with deterministic circular layout positions
  const count = nodes.length || 1;
  nodes.forEach((node: GraphNode, i: number) => {
    if (graph.hasNode(node.id)) return;

    const isSource = node.kind === "source" || node.category === "source";
    const isCreator = node.kind === "creator" || node.category === "creator";

    const size = isSource ? 9 : isCreator ? 7 : 12;
    const nodeType = isSource ? "source" : isCreator ? "creator" : "card";

    const angle = (i / count) * 2 * Math.PI;
    const radius = 60 + (i % 7) * 8;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    graph.addNode(node.id, {
      id: node.id,
      label: node.label || node.id,
      category: node.category,
      kind: node.kind,
      nodeType,
      size,
      x,
      y,
      color: getColor(node.category),
    });
  });

  // 2. Add edges safely, guarding against missing nodes
  edges.forEach((edge: GraphEdge) => {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
      // Unresolved targets or inventory items without nodes are skipped
      return;
    }

    if (graph.hasEdge(edge.source, edge.target)) {
      return;
    }

    // Sigma reads `type` as its render program name; keep ours under `edgeType`.
    graph.addEdge(edge.source, edge.target, {
      edgeType: edge.type,
      size: 1,
      color: getEdgeColor(edge.type),
    });
  });

  return graph;
}
