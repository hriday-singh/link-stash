import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SourceDetailPage } from "./SourceDetailPage";
import { api } from "@/api/client";

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ sourceId: "ig:DE-3r3_s" }),
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
    <a href={`${to.replace("$slug", params?.slug || "")}`} className={className}>
      {children}
    </a>
  ),
}));

describe("SourceDetailPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("renders source metadata, transcript stamps, mentions and cards", async () => {
    const user = userEvent.setup();

    vi.spyOn(api, "GET").mockImplementation(async (path: string) => {
      if (path === "/api/sources/{id}") {
        return {
          data: {
            source: {
              key: "ig:DE-3r3_s",
              platform: "instagram",
              creator: "@agentbuilder",
              url: "https://instagram.com/reel/DE-3r3_s",
              stage: "triaged",
              fetched_at: "2026-10-05",
              caption: "How to build modular coding agents without frameworks",
              summary: "A practical guide to building coding agents.",
              transcript: "At 0:12 we cover architecture, and at 1:05 we show subagents.",
              on_screen_text: ["Clean code", "Zero bloat"],
              mentions: [
                {
                  name: "Claude Code",
                  kind: "tool",
                  url: "https://anthropic.com",
                  at: "0:25",
                },
              ],
              video: "video.mp4",
              thumb: "thumb.jpg",
            },
            video_url: "/api/sources/ig:DE-3r3_s/video",
            thumb_url: "/api/sources/ig:DE-3r3_s/thumb",
            cards: [{ "agent-kit": "Agent Kit" }],
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
        <SourceDetailPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText("@agentbuilder")).toBeInTheDocument();
    expect(screen.getByText("How to build modular coding agents without frameworks")).toBeInTheDocument();
    expect(screen.getByText("A practical guide to building coding agents.")).toBeInTheDocument();
    expect(screen.getByText("Agent Kit")).toBeInTheDocument();
    expect(screen.getByText("Claude Code")).toBeInTheDocument();

    // Verify video element is rendered
    const video = screen.getByTestId("source-video-element") as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    const playSpy = vi.spyOn(video, "play").mockImplementation(async () => {});

    // Click transcript timestamp button (0:12)
    const stampBtn = screen.getByRole("button", { name: "0:12" });
    await user.click(stampBtn);
    expect(video.currentTime).toBe(12);
    expect(playSpy).toHaveBeenCalled();

    // Click mention timestamp chip (0:25)
    const mentionStampBtn = screen.getByTitle("Seek video to 0:25");
    await user.click(mentionStampBtn);
    expect(video.currentTime).toBe(25);
  });

  it("renders poster fallback when source has no video file", async () => {
    vi.spyOn(api, "GET").mockImplementation(async () => {
      return {
        data: {
          source: {
            key: "github:owner/repo",
            platform: "github",
            creator: "@octocat",
            url: "https://github.com/owner/repo",
            stage: "extracted",
            caption: "Octocat repository readme",
            transcript: null,
            video: null,
            thumb: null,
          },
          video_url: null,
          thumb_url: null,
          cards: [],
        },
        response: new Response(null, { status: 200 }),
      } as unknown as ReturnType<typeof api.GET>;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SourceDetailPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText("@octocat")).toBeInTheDocument();
    expect(screen.queryByTestId("source-video-element")).not.toBeInTheDocument();
    expect(screen.getByTestId("player-fallback")).toBeInTheDocument();
  });
});
