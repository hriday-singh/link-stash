import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Player, type PlayerHandle } from "./Player";

describe("Player Component", () => {
  it("renders poster fallback when hasVideo is false (no video player)", () => {
    render(
      <Player
        hasVideo={false}
        videoUrl="/api/sources/src-1/video"
        thumbUrl="https://example.com/poster.jpg"
        title="Sample Poster"
      />
    );

    expect(screen.queryByTestId("source-video-element")).not.toBeInTheDocument();
    expect(screen.getByTestId("player-fallback")).toBeInTheDocument();
    expect(screen.getByText("No video available")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/poster.jpg");
  });

  it("renders poster fallback when videoUrl is null", () => {
    render(<Player hasVideo={true} videoUrl={null} title="Missing URL" />);

    expect(screen.queryByTestId("source-video-element")).not.toBeInTheDocument();
    expect(screen.getByTestId("player-fallback")).toBeInTheDocument();
  });

  it("renders video element when hasVideo is true and videoUrl is provided", () => {
    render(
      <Player
        hasVideo={true}
        videoUrl="/api/sources/src-1/video"
        thumbUrl="/api/sources/src-1/thumb"
      />
    );

    const video = screen.getByTestId("source-video-element") as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("src", "/api/sources/src-1/video");
    expect(video).toHaveAttribute("preload", "metadata");
    expect(video).toHaveAttribute("poster", "/api/sources/src-1/thumb");
  });

  it("seeks video when seekTo imperative method is called", () => {
    const ref = React.createRef<PlayerHandle>();
    render(
      <Player
        ref={ref}
        hasVideo={true}
        videoUrl="/api/sources/src-1/video"
      />
    );

    const video = screen.getByTestId("source-video-element") as HTMLVideoElement;
    const playSpy = vi.spyOn(video, "play").mockImplementation(async () => {});

    expect(ref.current).not.toBeNull();
    ref.current?.seekTo(45);

    expect(video.currentTime).toBe(45);
    expect(playSpy).toHaveBeenCalled();
  });
});
