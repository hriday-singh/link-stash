import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Image01Icon, PlayIcon, PauseIcon } from "@hugeicons/core-free-icons";
import { MorphIcon } from "@/components/ui/MorphIcon";

export interface PlayerHandle {
  seekTo: (seconds: number) => void;
  play: () => Promise<void>;
  pause: () => void;
  currentTime: () => number;
}

export interface PlayerProps {
  videoUrl?: string | null;
  thumbUrl?: string | null;
  hasVideo: boolean;
  title?: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
}

export const Player = React.forwardRef<PlayerHandle, PlayerProps>(function Player(
  { videoUrl, thumbUrl, hasVideo, title, className = "", onTimeUpdate },
  ref
) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);

  React.useImperativeHandle(
    ref,
    () => ({
      seekTo: (seconds: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = seconds;
          videoRef.current.play().catch(() => {
            // Browser autoplay / play policy guard
          });
        }
      },
      play: async () => {
        if (videoRef.current) {
          await videoRef.current.play();
        }
      },
      pause: () => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
      },
      currentTime: () => {
        return videoRef.current ? videoRef.current.currentTime : 0;
      },
    }),
    []
  );

  // If there's no video (carousel, fetch failure, or audio/text-only source)
  if (!hasVideo || !videoUrl) {
    return (
      <div
        data-testid="player-fallback"
        className={`relative aspect-video w-full overflow-hidden rounded-xl border border-border/70 bg-surface-sunken flex flex-col items-center justify-center shadow-xs ${className}`.trim()}
      >
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={title || "Source poster"}
            className="size-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
            <HugeiconsIcon icon={Image01Icon} className="size-10 text-muted-foreground/50" strokeWidth={1.5} />
            <p className="text-xs font-medium text-foreground">Media Poster</p>
            <span className="font-mono text-2xs text-muted-foreground">No video file available</span>
          </div>
        )}
        <div className="absolute bottom-3 right-3 rounded-md bg-background/80 px-2 py-0.5 text-2xs font-medium text-muted-foreground backdrop-blur-xs border border-border/40">
          No video available
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="player-container"
      className={`relative aspect-video w-full overflow-hidden rounded-xl border border-border/70 bg-black shadow-xs ${className}`.trim()}
    >
      <video
        ref={videoRef}
        data-testid="source-video-element"
        src={videoUrl}
        poster={thumbUrl || undefined}
        preload="metadata"
        controls
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          if (videoRef.current && onTimeUpdate) {
            onTimeUpdate(videoRef.current.currentTime);
          }
        }}
        className="size-full object-contain"
      >
        <track kind="captions" />
      </video>

      <button
        type="button"
        data-testid="player-morph-play-button"
        aria-label={isPlaying ? "Pause video" : "Play video"}
        onClick={() => {
          if (videoRef.current) {
            if (videoRef.current.paused) {
              videoRef.current.play().catch(() => {});
            } else {
              videoRef.current.pause();
            }
          }
        }}
        className="absolute bottom-14 left-4 z-10 flex size-9 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur-xs transition hover:bg-background focus-visible:outline-2 focus-visible:outline-ring"
      >
        <MorphIcon
          icon={isPlaying ? PauseIcon : PlayIcon}
          label={isPlaying ? "Pause" : "Play"}
          size={16}
        />
      </button>
    </div>
  );
});
