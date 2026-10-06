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

  it("renders source metadata, transcript stamps, mentions, and extracted cards with proper links", async () => {
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
            // Both server dict shape {slug, title, ...} and key-value shape supported
            cards: [{ slug: "agent-kit", title: "Agent Kit", category: "models", kind: "model" }],
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
      </QueryClientProvider>,
    );

    expect(await screen.findByText("@agentbuilder")).toBeInTheDocument();
    expect(
      screen.getByText("How to build modular coding agents without frameworks"),
    ).toBeInTheDocument();
    expect(screen.getByText("A practical guide to building coding agents.")).toBeInTheDocument();
    expect(screen.getByText("Agent Kit")).toBeInTheDocument();
    expect(screen.getByText("Claude Code")).toBeInTheDocument();

    // Verify Open User button is rendered beside creator with direct link
    const openUserLink = screen.getByTitle("Open @agentbuilder profile on instagram");
    expect(openUserLink).toBeInTheDocument();
    expect(openUserLink).toHaveAttribute("href", "https://instagram.com/agentbuilder");

    // Verify Open Original source link is rendered in header
    const openOriginalLink = screen.getByRole("link", { name: /Open Original/i });
    expect(openOriginalLink).toHaveAttribute("href", "https://instagram.com/reel/DE-3r3_s");

    // Verify extracted card routes to /c/agent-kit, not /c/slug
    const cardLink = screen.getByRole("link", { name: /Agent Kit/i });
    expect(cardLink).toHaveAttribute("href", "/c/agent-kit");

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
            stage: "analyzed",
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
      </QueryClientProvider>,
    );

    expect(await screen.findByText("@octocat")).toBeInTheDocument();
    expect(screen.queryByTestId("source-video-element")).not.toBeInTheDocument();
    expect(screen.getByTestId("player-fallback")).toBeInTheDocument();

    // Verify Triage with Agent button is rendered for analyzed source
    const triageBtn = screen.getByTestId("source-triage-button");
    expect(triageBtn).toBeInTheDocument();
    expect(triageBtn).toHaveTextContent("Triage with Agent");
  });

  it("handles stage update, recheck request, and share actions", async () => {
    const user = userEvent.setup();

    const patchSpy = vi.spyOn(api, "PATCH").mockResolvedValue({
      data: {
        source: {
          key: "ig:DE-3r3_s",
          platform: "instagram",
          creator: "@agentbuilder",
          url: "https://instagram.com/reel/DE-3r3_s",
          stage: "analyzed",
          caption: "caption",
        },
        cards: [],
      },
      response: new Response(null, { status: 200 }),
    } as unknown as Awaited<ReturnType<typeof api.PATCH>>);

    const postSpy = vi.spyOn(api, "POST").mockResolvedValue({
      data: {
        source: {
          key: "ig:DE-3r3_s",
          platform: "instagram",
          creator: "@agentbuilder",
          url: "https://instagram.com/reel/DE-3r3_s",
          stage: "analyzed",
          caption: "caption",
        },
        cards: [],
      },
      response: new Response(null, { status: 200 }),
    } as unknown as Awaited<ReturnType<typeof api.POST>>);

    vi.spyOn(api, "GET").mockResolvedValue({
      data: {
        source: {
          key: "ig:DE-3r3_s",
          platform: "instagram",
          creator: "@agentbuilder",
          url: "https://instagram.com/reel/DE-3r3_s",
          stage: "triaged",
          caption: "caption",
        },
        cards: [],
      },
      response: new Response(null, { status: 200 }),
    } as unknown as Awaited<ReturnType<typeof api.GET>>);

    render(
      <QueryClientProvider client={queryClient}>
        <SourceDetailPage />
      </QueryClientProvider>,
    );

    // Verify recheck button is rendered for triaged source
    const recheckBtn = await screen.findByTestId("source-recheck-button");
    expect(recheckBtn).toBeInTheDocument();
    await user.click(recheckBtn);
    expect(postSpy).toHaveBeenCalledWith("/api/sources/{id}/recheck", expect.anything());

    // Verify stage selector chip clicks call PATCH stage
    const stageSelector = screen.getByTestId("source-stage-selector");
    expect(stageSelector).toBeInTheDocument();
    const fetchedChip = screen.getByRole("button", { name: "New" });
    await user.click(fetchedChip);
    expect(patchSpy).toHaveBeenCalledWith(
      "/api/sources/{id}/stage",
      expect.objectContaining({
        body: { stage: "fetched" },
      }),
    );

    // Verify share button and copy URL button are rendered
    expect(screen.getByTestId("source-share-button")).toBeInTheDocument();
    expect(screen.getByTestId("source-copy-url-button")).toBeInTheDocument();
  });
});
