import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SourcesPage } from "./SourcesPage";
import { api } from "@/api/client";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
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

describe("SourcesPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("renders source cards when sources are loaded", async () => {
    vi.spyOn(api, "GET").mockImplementation(async (path: string) => {
      if (path === "/api/sources") {
        return {
          data: {
            items: [
              {
                id: "ig:DE-3r3_s",
                platform: "instagram",
                creator: "@agentbuilder",
                url: "https://instagram.com/reel/DE-3r3_s",
                title: "How to build coding agents",
                stage: "triaged",
                has_video: true,
                has_thumb: true,
                thumb_url: "https://example.com/thumb.jpg",
                added: "2026-10-05",
              },
              {
                id: "github:owner/repo",
                platform: "github",
                creator: "@octocat",
                url: "https://github.com/owner/repo",
                title: "Octocat Repository",
                stage: "analyzed",
                has_video: false,
                has_thumb: false,
                added: "2026-10-04",
              },
            ],
            next_cursor: null,
          },
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
        <SourcesPage filters={{}} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("@agentbuilder")).toBeInTheDocument();
    expect(screen.getAllByText("@octocat").length).toBeGreaterThan(0);
    expect(screen.getByText("https://instagram.com/reel/DE-3r3_s")).toBeInTheDocument();
    expect(screen.getByText("https://github.com/owner/repo")).toBeInTheDocument();
    expect(screen.getAllByText("Triaged")).toHaveLength(2);
    // Label shows on both the stage filter pill and the card badge.
    expect(screen.getAllByText("Analyzed")).toHaveLength(2);
    expect(screen.getByText("Video")).toBeInTheDocument();

    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(screen.getByRole("button", { name: "Copy /stash (2)" }));
    expect(writeText).toHaveBeenCalledWith(
      "/stash https://instagram.com/reel/DE-3r3_s https://github.com/owner/repo",
    );
  });

  it("renders empty state when no sources are returned", async () => {
    vi.spyOn(api, "GET").mockImplementation(async () => {
      return {
        data: {
          items: [],
          next_cursor: null,
        },
        response: new Response(null, { status: 200 }),
      } as unknown as ReturnType<typeof api.GET>;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SourcesPage filters={{ platform: "instagram" }} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("No sources found.")).toBeInTheDocument();
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
  });
});
