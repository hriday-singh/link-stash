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
import { LocalGraph } from "./LocalGraph";
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

// Mock GraphView so we don't spin up full WebGL/Sigma in this unit test
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
      <span data-testid="mock-node-count">{graphData.nodes?.length ?? 0}</span>
      <span>{emptyMessage}</span>
      <button
        type="button"
        onClick={() => onSelectNode?.("connected-card", "card")}
      >
        Click Card
      </button>
      <button
        type="button"
        onClick={() => onSelectNode?.("ig:test-reel", "source")}
      >
        Click Source
      </button>
      <button
        type="button"
        onClick={() => onSelectNode?.("creator:promptdev", "creator")}
      >
        Click Creator
      </button>
    </div>
  ),
}));

async function renderLocalGraph(slug: string, queryClient: QueryClient) {
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <LocalGraph slug={slug} />
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

describe("LocalGraph", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("renders 1 hop and 2 hops depth switcher", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: {
        nodes: [{ id: "test-card", label: "Test Card", category: "models", kind: "model", size: 12 }],
        edges: [],
      },
      error: undefined,
      response: new Response(),
    });

    await renderLocalGraph("test-card", queryClient);

    expect(screen.getByText("Neighborhood")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 hop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2 hops" })).toBeInTheDocument();
  });

  it("changes depth to 2 when 2 hops option is clicked", async () => {
    const user = userEvent.setup();

    vi.mocked(api.GET).mockImplementation((_path, options) => {
      const query = (options as { params?: { query?: { depth?: number } } })?.params?.query;
      const depth = query?.depth ?? 1;

      if (depth === 2) {
        return Promise.resolve({
          data: {
            nodes: [
              { id: "test-card", label: "Test Card", category: "models", kind: "model", size: 12 },
              { id: "sibling-card", label: "Sibling Card", category: "models", kind: "model", size: 12 },
            ],
            edges: [{ source: "test-card", target: "sibling-card", type: "wikilink" }],
          },
          error: undefined,
          response: new Response(),
        });
      }

      return Promise.resolve({
        data: {
          nodes: [{ id: "test-card", label: "Test Card", category: "models", kind: "model", size: 12 }],
          edges: [],
        },
        error: undefined,
        response: new Response(),
      });
    });

    await renderLocalGraph("test-card", queryClient);

    const countElem = await screen.findByTestId("mock-node-count");
    expect(countElem).toHaveTextContent("1");

    const twoHopsBtn = screen.getByRole("button", { name: "2 hops" });
    await user.click(twoHopsBtn);

    expect(await screen.findByTestId("node-count-badge")).toHaveTextContent("2");
  });

  it("handles node click callbacks without throwing", async () => {
    const user = userEvent.setup();

    vi.mocked(api.GET).mockResolvedValue({
      data: {
        nodes: [{ id: "test-card", label: "Test Card", category: "models", kind: "model", size: 12 }],
        edges: [],
      },
      error: undefined,
      response: new Response(),
    });

    await renderLocalGraph("test-card", queryClient);

    const clickCardBtn = await screen.findByRole("button", { name: "Click Card" });
    await user.click(clickCardBtn);

    const clickSourceBtn = await screen.findByRole("button", { name: "Click Source" });
    await user.click(clickSourceBtn);

    const clickCreatorBtn = await screen.findByRole("button", { name: "Click Creator" });
    await user.click(clickCreatorBtn);
  });
});
