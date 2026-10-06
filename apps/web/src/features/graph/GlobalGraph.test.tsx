import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { GlobalGraph, type GlobalGraphProps } from "./GlobalGraph";
import { parseGraphSearch } from "./types";
import { api } from "@/api/client";

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();
  return {
    ...actual,
    api: {
      GET: vi.fn(),
    },
  };
});

// Mock GraphView to avoid WebGL context requirements in jsdom
vi.mock("./GraphView", () => ({
  GraphView: ({
    graphData,
    onSelectNode,
    emptyMessage,
  }: {
    graphData: { nodes?: Array<{ id: string; label: string }> };
    onSelectNode?: (id: string, type: "card" | "source" | "creator") => void;
    emptyMessage?: string;
  }) => (
    <div data-testid="mock-graph-view">
      <span data-testid="mock-nodes-count">{graphData.nodes?.length ?? 0}</span>
      <span>{emptyMessage}</span>
      <button type="button" onClick={() => onSelectNode?.("card-1", "card")}>
        Select Card
      </button>
      <button type="button" onClick={() => onSelectNode?.("ig:test-1", "source")}>
        Select Source
      </button>
      <button type="button" onClick={() => onSelectNode?.("creator:devlead", "creator")}>
        Select Creator
      </button>
    </div>
  ),
}));

async function renderGlobalGraph(props: GlobalGraphProps, queryClient: QueryClient) {
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <GlobalGraph {...props} />
      </QueryClientProvider>
    ),
  });

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  await router.load();
  return render(<RouterProvider router={router} />);
}

describe("GlobalGraph & parseGraphSearch", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  describe("parseGraphSearch", () => {
    it("parses valid search parameters", () => {
      const parsed = parseGraphSearch({
        category: "models",
        edge_type: "wikilink",
      });
      expect(parsed).toEqual({
        category: "models",
        edge_type: "wikilink",
      });
    });

    it("cleans empty and invalid parameters", () => {
      const parsed = parseGraphSearch({
        category: "",
        edge_type: "invalid_type",
      });
      expect(parsed).toEqual({
        category: undefined,
        edge_type: undefined,
      });
    });
  });

  describe("GlobalGraph component", () => {
    it("renders page header and filter controls", async () => {
      vi.mocked(api.GET).mockImplementation((path) => {
        if (path === "/api/meta") {
          return Promise.resolve({
            data: {
              categories: [
                { name: "models", color: "cat-models", count: 5 },
                { name: "repos-tools", color: "cat-repos-tools", count: 10 },
              ],
              tags: [],
              counts: { cards: 15, sources: 5, pending: 0, rejected: 0, inventory: 2 },
              version: "0.1.0",
            },
            error: undefined,
            response: new Response(),
          });
        }
        return Promise.resolve({
          data: {
            nodes: [
              { id: "c1", label: "Card 1", category: "models", kind: "model", size: 12 },
              { id: "s1", label: "Source 1", category: "source", kind: "source", size: 9 },
            ],
            edges: [{ source: "c1", target: "s1", type: "source" }],
          },
          error: undefined,
          response: new Response(),
        });
      });

      const onFilterChange = vi.fn();
      await renderGlobalGraph({ filters: {}, onFilterChange }, queryClient);

      expect(screen.getByText("Global knowledge graph")).toBeInTheDocument();
      expect(
        await screen.findByText("2 nodes · 1 edges across cards, sources and creators"),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Wikilinks" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sources" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Overlaps" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "All categories" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "models" })).toBeInTheDocument();
    });

    it("calls onFilterChange when selecting edge type", async () => {
      const user = userEvent.setup();

      vi.mocked(api.GET).mockResolvedValue({
        data: { nodes: [], edges: [] },
        error: undefined,
        response: new Response(),
      });

      const onFilterChange = vi.fn();
      await renderGlobalGraph({ filters: {}, onFilterChange }, queryClient);

      const wikilinksBtn = screen.getByRole("button", { name: "Wikilinks" });
      await user.click(wikilinksBtn);

      expect(onFilterChange).toHaveBeenCalledWith({
        edge_type: "wikilink",
      });
    });

    it("calls onFilterChange when selecting category", async () => {
      const user = userEvent.setup();

      vi.mocked(api.GET).mockImplementation((path) => {
        if (path === "/api/meta") {
          return Promise.resolve({
            data: {
              categories: [{ name: "repos-tools", color: "cat-repos-tools", count: 10 }],
              tags: [],
              counts: { cards: 10, sources: 2, pending: 0, rejected: 0, inventory: 0 },
              version: "0.1.0",
            },
            error: undefined,
            response: new Response(),
          });
        }
        return Promise.resolve({
          data: { nodes: [], edges: [] },
          error: undefined,
          response: new Response(),
        });
      });

      const onFilterChange = vi.fn();
      await renderGlobalGraph({ filters: {}, onFilterChange }, queryClient);

      const catBtn = await screen.findByRole("button", { name: "repos-tools" });
      await user.click(catBtn);

      expect(onFilterChange).toHaveBeenCalledWith({
        category: "repos-tools",
      });
    });

    it("resets filters when clicking Reset filters button", async () => {
      const user = userEvent.setup();

      vi.mocked(api.GET).mockResolvedValue({
        data: { nodes: [], edges: [] },
        error: undefined,
        response: new Response(),
      });

      const onFilterChange = vi.fn();
      await renderGlobalGraph(
        { filters: { category: "models", edge_type: "source" }, onFilterChange },
        queryClient,
      );

      const resetBtn = screen.getByRole("button", { name: /Reset filters/i });
      await user.click(resetBtn);

      expect(onFilterChange).toHaveBeenCalledWith({});
    });

    it("handles node selection callbacks without error", async () => {
      const user = userEvent.setup();

      vi.mocked(api.GET).mockResolvedValue({
        data: {
          nodes: [{ id: "c1", label: "C1", category: "models", kind: "model", size: 12 }],
          edges: [],
        },
        error: undefined,
        response: new Response(),
      });

      await renderGlobalGraph({ filters: {}, onFilterChange: vi.fn() }, queryClient);

      const selectCardBtn = await screen.findByRole("button", { name: "Select Card" });
      await user.click(selectCardBtn);

      const selectSourceBtn = await screen.findByRole("button", { name: "Select Source" });
      await user.click(selectSourceBtn);

      const selectCreatorBtn = await screen.findByRole("button", { name: "Select Creator" });
      await user.click(selectCreatorBtn);
    });
  });
});
