import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Image01Icon,
  PlayIcon,
  PauseIcon,
  VolumeHighIcon,
  VolumeMute01Icon,
  FullScreenIcon,
} from "@hugeicons/core-free-icons";
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

function formatTime(seconds: number): string {
  if (Number.isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const Player = React.forwardRef<PlayerHandle, PlayerProps>(function Player(
  { videoUrl, thumbUrl, hasVideo, title, className = "", onTimeUpdate },
  ref,
) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [isMuted, setIsMuted] = React.useState(false);
  const [showControls, setShowControls] = React.useState(true);
  const hideTimeoutRef = React.useRef<number | null>(null);

  React.useImperativeHandle(
    ref,
    () => ({
      seekTo: (seconds: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = seconds;
          videoRef.current.play().catch(() => {
            // Autoplay policy guard
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
    [],
  );

  const resetHideTimer = React.useCallback(() => {
    setShowControls(true);
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
    }
    if (isPlaying) {
      hideTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  }, [isPlaying]);

  React.useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
      }
    } else {
      resetHideTimer();
    }
    return () => {
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isPlaying, resetHideTimer]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number.parseFloat(e.target.value);
    if (videoRef.current && Number.isFinite(val)) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  // If there's no video (carousel, fetch failure, or audio/text-only source)
  if (!hasVideo || !videoUrl) {
    return (
      <div
        data-testid="player-fallback"
        className={`relative aspect-video w-full overflow-hidden rounded-xl border border-border/70 bg-surface-sunken flex flex-col items-center justify-center shadow-xs ${className}`.trim()}
      >
        {thumbUrl ? (
          <img src={thumbUrl} alt={title || "Source poster"} className="size-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
            <HugeiconsIcon
              icon={Image01Icon}
              className="size-10 text-muted-foreground/50"
              strokeWidth={1.5}
            />
            <p className="text-xs font-medium text-foreground">Media Poster</p>
            <span className="font-mono text-2xs text-muted-foreground">
              No video file available
            </span>
          </div>
        )}
        <div className="absolute bottom-3 right-3 rounded-md bg-background/80 px-2 py-0.5 text-2xs font-medium text-muted-foreground backdrop-blur-xs border border-border/40">
          No video available
        </div>
      </div>
    );
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      data-testid="player-container"
      onMouseMove={resetHideTimer}
      onMouseEnter={() => setShowControls(true)}
      onClick={togglePlay}
      className={`group relative aspect-video w-full overflow-hidden rounded-xl border border-border/70 bg-black shadow-xs select-none cursor-pointer ${className}`.trim()}
    >
      <video
        ref={videoRef}
        data-testid="source-video-element"
        src={videoUrl}
        poster={thumbUrl || undefined}
        preload="metadata"
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration || 0);
          }
        }}
        onTimeUpdate={() => {
          if (videoRef.current) {
            const cur = videoRef.current.currentTime;
            setCurrentTime(cur);
            if (onTimeUpdate) {
              onTimeUpdate(cur);
            }
          }
        }}
        className="size-full object-contain pointer-events-none"
      >
        <track kind="captions" />
      </video>

      {/* Large Center Play Overlay (visible when paused) */}
      {!isPlaying && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px] transition-opacity duration-200">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95">
            <HugeiconsIcon icon={PlayIcon} className="size-7 translate-x-0.5" strokeWidth={2} />
          </div>
        </div>
      )}

      {/* Unified Custom Control Bar (overlay at bottom) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-8 transition-opacity duration-200 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Scrubber / Timeline Slider */}
        <div className="relative mb-2.5 flex items-center group/scrubber cursor-pointer">
          <div className="relative h-1.5 w-full rounded-full bg-white/20 transition-[height] group-hover/scrubber:h-2">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-primary"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeekChange}
            aria-label="Seek video timeline"
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            {/* Morph Play/Pause Button */}
            <button
              type="button"
              data-testid="player-morph-play-button"
              aria-label={isPlaying ? "Pause video" : "Play video"}
              onClick={togglePlay}
              className="flex size-8 min-w-[32px] items-center justify-center rounded-lg bg-white/10 text-white backdrop-blur-xs transition hover:bg-white/20 active:scale-95 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <MorphIcon
                icon={isPlaying ? PauseIcon : PlayIcon}
                label={isPlaying ? "Pause" : "Play"}
                size={16}
              />
            </button>

            {/* Time Display */}
            <span className="font-mono text-2xs font-medium text-white/90 select-none">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Mute Button */}
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? "Unmute audio" : "Mute audio"}
              className="flex size-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition focus-visible:outline-2 focus-visible:outline-ring"
            >
              <HugeiconsIcon
                icon={isMuted ? VolumeMute01Icon : VolumeHighIcon}
                className="size-4"
                strokeWidth={1.5}
              />
            </button>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Toggle fullscreen"
              className="flex size-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition focus-visible:outline-2 focus-visible:outline-ring"
            >
              <HugeiconsIcon icon={FullScreenIcon} className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
