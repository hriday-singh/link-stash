import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PendingPage } from "./PendingPage";
import { api } from "@/api/client";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    className,
  }: {
    children?: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
  }) => (
    <a href={`${to.replace("$sourceId", params?.sourceId || "")}`} className={className}>
      {children}
    </a>
  ),
}));

describe("PendingPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("renders pending items with open and ready states", async () => {
    vi.spyOn(api, "GET").mockImplementation(async (path: string) => {
      if (path === "/api/pending") {
        return {
          data: [
            {
              id: "p-1",
              kind: "cta",
              source_key: "ig:DE-3r3_s",
              instruction: "Comment 'TOOLKIT' on reel for prompt guide",
              status: "open",
              added: "2026-10-05",
            },
            {
              id: "p-2",
              kind: "blocked",
              source_key: null,
              instruction: "Paste manual link for blocked embed",
              url: "https://example.com/resolved",
              status: "ready",
              added: "2026-10-04",
            },
          ],
          response: new Response(null, { status: 200 }),
        } as unknown as ReturnType<typeof api.GET>;
      }
      return {
        data: null,
        response: new Response(null, { status: 404 }),
      } as unknown as ReturnType<typeof api.GET>;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PendingPage />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("Comment 'TOOLKIT' on reel for prompt guide"),
    ).toBeInTheDocument();
    expect(screen.getByText("Paste manual link for blocked embed")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
    expect(screen.getByText("ready")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/resolved")).toBeInTheDocument();
  });

  it("resolves an open pending item", async () => {
    const user = userEvent.setup();

    vi.spyOn(api, "GET").mockImplementation(async (path: string) => {
      if (path === "/api/pending") {
        return {
          data: [
            {
              id: "p-1",
              kind: "cta",
              source_key: "ig:DE-3r3_s",
              instruction: "Comment 'TOOLKIT' on reel for prompt guide",
              status: "open",
              added: "2026-10-05",
            },
          ],
          response: new Response(null, { status: 200 }),
        } as unknown as ReturnType<typeof api.GET>;
      }
      return {
        data: null,
        response: new Response(null, { status: 404 }),
      } as unknown as ReturnType<typeof api.GET>;
    });

    const postSpy = vi.spyOn(api, "POST").mockImplementation(async () => {
      return {
        data: {
          id: "p-1",
          kind: "cta",
          status: "ready",
          url: "https://example.com/guide",
          added: "2026-10-05",
          instruction: "Comment 'TOOLKIT'",
        },
        response: new Response(null, { status: 200 }),
      } as unknown as ReturnType<typeof api.POST>;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PendingPage />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("Comment 'TOOLKIT' on reel for prompt guide"),
    ).toBeInTheDocument();

    const input = screen.getByRole("textbox");
    const resolveBtn = screen.getByRole("button", { name: "Resolve & Save" });

    await user.type(input, "https://example.com/guide");
    await user.click(resolveBtn);

    expect(postSpy).toHaveBeenCalledWith("/api/pending/{id}/resolve", {
      params: { path: { id: "p-1" } },
      body: { url: "https://example.com/guide" },
    });
  });

  it("renders one-line empty state when no pending items exist", async () => {
    vi.spyOn(api, "GET").mockImplementation(async () => {
      return {
        data: [],
        response: new Response(null, { status: 200 }),
      } as unknown as ReturnType<typeof api.GET>;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PendingPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("No pending link requests.")).toBeInTheDocument();
  });
});
