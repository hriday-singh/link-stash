import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/api/client";
import { CardPage } from "./CardPage";

describe("CardPage Route (/c/$slug)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    vi.spyOn(api, "GET").mockImplementation(async (path: string, options?: unknown) => {
      const opts = options as { params?: { path?: { slug?: string } } } | undefined;

      if (path === "/api/cards/{slug}") {
        const slug = opts?.params?.path?.slug || "agent-kit";
        return {
          data: {
            slug,
            hash: "card-hash-123",
            body: "## What it is\nA great library for agents.\nCheck [[other-card]].",
            notes: "My personal thoughts",
            resolved: { "other-card": "Other Card Title" },
            card: {
              schema: 1,
              key: "github:user/agent-kit",
              title: "Agent Kit",
              category: "models",
              kind: "model",
              added: "2026-10-06",
              tags: ["agent", "python"],
              url: "https://github.com/user/agent-kit",
              sources: ["src-1"],
              overlaps: [],
              facts: { stars: 3400 },
              features: ["Fast reasoning"],
            },
          },
          response: new Response(null, { status: 200 }),
        } as unknown as ReturnType<typeof api.GET>;
      }

      if (path === "/api/cards/{slug}/links") {
        return {
          data: {
            backlinks: [{ slug: "parent-card", title: "Parent Card" }],
            mentioned_by: [{ id: "src-1", creator: "techlead", platform: "instagram" }],
            outgoing: [{ slug: "other-card", title: "Other Card Title" }],
          },
          response: new Response(null, { status: 200 }),
        } as unknown as ReturnType<typeof api.GET>;
      }

      if (path === "/api/meta") {
        return {
          data: {
            categories: [
              { name: "models", color: "cat-models", count: 10 },
              { name: "repos-tools", color: "cat-repos-tools", count: 5 },
            ],
            tags: [{ tag: "agent", count: 12 }],
            counts: { cards: 15, sources: 5, pending: 0, rejected: 0, inventory: 2 },
            version: "0.1.0",
          },
          response: new Response(null, { status: 200 }),
        } as unknown as ReturnType<typeof api.GET>;
      }

      return {
        error: { message: "Not found" },
        response: new Response(null, { status: 404 }),
      } as unknown as ReturnType<typeof api.GET>;
    });
  });

  async function renderCardRoute(slug: string = "agent-kit") {
    const rootRoute = createRootRoute();
    const cardRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/c/$slug",
      component: CardPage,
    });
    const routeTree = rootRoute.addChildren([cardRoute]);
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: [`/c/${slug}`] }),
    });

    await router.load();

    return render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  }

  it("renders card title, category, kind, body, notes, and properties", async () => {
    await renderCardRoute("agent-kit");

    expect(await screen.findByRole("heading", { name: "Agent Kit" })).toBeInTheDocument();
    expect(screen.getAllByText("github:user/agent-kit")).toHaveLength(2);
    expect(screen.getByText("What it is")).toBeInTheDocument();
    expect(screen.getByText(/A great library for agents/)).toBeInTheDocument();
    expect(screen.getByText("Other Card Title")).toBeInTheDocument();
    expect(screen.getByText("My personal thoughts")).toBeInTheDocument();
    expect(screen.getByText("agent")).toBeInTheDocument();
    expect(screen.getByText("python")).toBeInTheDocument();
  });

  it("renders connections panels: backlinks, mentioned by, and outgoing links", async () => {
    await renderCardRoute("agent-kit");

    expect(await screen.findByText("Backlinks (1)")).toBeInTheDocument();
    expect(screen.getByText("Parent Card")).toBeInTheDocument();

    expect(screen.getByText("Mentioned By (1)")).toBeInTheDocument();
    expect(screen.getByText("@techlead")).toBeInTheDocument();

    expect(screen.getByText("Outgoing Links (1)")).toBeInTheDocument();
  });

  it("opens reject confirmation dialog when clicking reject from actions menu", async () => {
    const user = userEvent.setup();
    await renderCardRoute("agent-kit");

    expect(await screen.findByRole("heading", { name: "Agent Kit" })).toBeInTheDocument();

    const menuTrigger = screen.getByRole("button", { name: "More card actions" });
    await user.click(menuTrigger);

    const rejectItem = await screen.findByRole("menuitem", { name: /Reject Card/i });
    await user.click(rejectItem);

    expect(await screen.findByRole("heading", { name: "Reject Card" })).toBeInTheDocument();
  });
});
