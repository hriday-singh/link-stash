import { describe, expect, it } from "vitest";
import { toGraphology } from "./toGraphology";

describe("toGraphology", () => {
  it("converts nodes with sizes matching node type", () => {
    const graph = toGraphology({
      nodes: [
        { id: "c1", label: "Card One", category: "repos-tools", kind: "tool", size: 10 },
        { id: "s1", label: "ig:123", category: "source", kind: "source", size: 10 },
        { id: "cr1", label: "@creator", category: "creator", kind: "creator", size: 10 },
      ],
      edges: [],
    });

    expect(graph.order).toBe(3);

    expect(graph.getNodeAttribute("c1", "size")).toBe(12);
    expect(graph.getNodeAttribute("c1", "nodeType")).toBe("card");

    expect(graph.getNodeAttribute("s1", "size")).toBe(9);
    expect(graph.getNodeAttribute("s1", "nodeType")).toBe("source");

    expect(graph.getNodeAttribute("cr1", "size")).toBe(7);
    expect(graph.getNodeAttribute("cr1", "nodeType")).toBe("creator");
  });

  it("skips edges pointing to missing/unresolved nodes", () => {
    const graph = toGraphology({
      nodes: [
        { id: "c1", label: "Card One", category: "repos-tools", kind: "tool", size: 10 },
        { id: "c2", label: "Card Two", category: "models", kind: "model", size: 10 },
      ],
      edges: [
        { source: "c1", target: "c2", type: "wikilink" },
        // Broken edge to missing node
        { source: "c1", target: "missing-target", type: "wikilink" },
        // Broken edge from missing node
        { source: "non-existent", target: "c2", type: "overlap" },
      ],
    });

    expect(graph.order).toBe(2);
    // Only the valid edge between existing nodes is added
    expect(graph.size).toBe(1);
    expect(graph.hasEdge("c1", "c2")).toBe(true);
  });

  it("applies custom color resolver", () => {
    const customColors: Record<string, string> = {
      models: "#ff00ff",
      source: "#ffff00",
    };

    const graph = toGraphology(
      {
        nodes: [
          { id: "m1", label: "Model", category: "models", kind: "model", size: 10 },
          { id: "s1", label: "Source", category: "source", kind: "source", size: 10 },
        ],
        edges: [],
      },
      {
        resolveColor: (cat) => customColors[cat] ?? "#000000",
      },
    );

    expect(graph.getNodeAttribute("m1", "color")).toBe("#ff00ff");
    expect(graph.getNodeAttribute("s1", "color")).toBe("#ffff00");
  });

  it("assigns valid coordinates for layout initialization", () => {
    const graph = toGraphology({
      nodes: [
        { id: "c1", label: "C1", category: "misc", kind: "link", size: 10 },
        { id: "c2", label: "C2", category: "misc", kind: "link", size: 10 },
      ],
      edges: [],
    });

    const x1 = graph.getNodeAttribute("c1", "x");
    const y1 = graph.getNodeAttribute("c1", "y");
    const x2 = graph.getNodeAttribute("c2", "x");
    const y2 = graph.getNodeAttribute("c2", "y");

    expect(typeof x1).toBe("number");
    expect(typeof y1).toBe("number");
    expect(typeof x2).toBe("number");
    expect(typeof y2).toBe("number");
    expect(Number.isFinite(x1)).toBe(true);
    expect(Number.isFinite(y1)).toBe(true);
  });
});
