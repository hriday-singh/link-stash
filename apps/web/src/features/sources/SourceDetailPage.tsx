import * as React from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft02Icon,
  LinkSquare02Icon,
  Layers01Icon,
  Clock01Icon,
  TextIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { api, unwrap, type SourceDetail } from "@/api/client";
import { queryKeys } from "@/api/keys";
import { BrandLogo } from "@/components/BrandLogo";
import { Player, type PlayerHandle } from "./Player";
import { splitStamps, parseStamp } from "./stamps";
import { stageLabel } from "./filters";

export function SourceDetailPage() {
  const { sourceId } = useParams({ strict: false }) as { sourceId: string };
  const playerRef = React.useRef<PlayerHandle>(null);

  const { data: detail, isLoading, isError } = useQuery<SourceDetail>({
    queryKey: queryKeys.source(sourceId),
    queryFn: async () => {
      return await unwrap(
        api.GET("/api/sources/{id}", {
          params: { path: { id: sourceId } },
        })
      );
    },
    enabled: Boolean(sourceId),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-6 w-32 animate-pulse rounded bg-surface-sunken" />
        <div className="aspect-video w-full animate-pulse rounded-xl bg-surface-sunken" />
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-12 text-center text-xs">
        <p className="font-semibold text-destructive">Failed to load source</p>
        <p className="text-muted-foreground">The source could not be found or failed to load.</p>
        <Link
          to="/sources"
          className="rounded-lg border border-border/80 bg-background px-3 py-1.5 font-medium text-foreground hover:bg-muted"
        >
          Back to Sources
        </Link>
      </div>
    );
  }

  const { source } = detail;
  const transcriptChunks = source.transcript ? splitStamps(source.transcript) : [];
  const cards = detail.cards ?? [];
  const mentions = source.mentions ?? [];
  const onScreenTexts = source.on_screen_text ?? [];

  const handleSeek = (seconds: number) => {
    playerRef.current?.seekTo(seconds);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Navigation and Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/sources"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} className="size-3.5" strokeWidth={1.5} />
          <span>Back to Sources</span>
        </Link>

        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface-sunken px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50"
          >
            <span>Open Original</span>
            <HugeiconsIcon icon={LinkSquare02Icon} className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
          </a>
        )}
      </div>

      {/* Main Grid: Player on left, Context on right */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Left Column: Player & Metadata */}
        <div className="flex flex-col gap-5">
          <Player
            ref={playerRef}
            videoUrl={detail.video_url}
            thumbUrl={detail.thumb_url}
            hasVideo={Boolean(source.video || detail.video_url)}
            title={source.caption || source.url}
          />

          {/* Source Header Information */}
          <header className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BrandLogo brand={source.platform} size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {source.platform}
                </span>
                {source.creator && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-xs font-medium text-primary">{source.creator}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 font-mono text-2xs uppercase tracking-wider">
                  {stageLabel(source.stage)}
                </span>
                {source.fetched_at && (
                  <time dateTime={source.fetched_at} className="text-2xs text-muted-foreground">
                    {new Date(source.fetched_at).toLocaleString()}
                  </time>
                )}
              </div>
            </div>

            {source.caption && (
              <p className="mt-1 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {source.caption}
              </p>
            )}

            <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-2xs text-muted-foreground">
              <span className="font-mono">{source.key}</span>
              {source.engine && <span>Engine: {source.engine}</span>}
            </div>
          </header>

          {/* Cards Extracted from this Source */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Layers01Icon} className="size-4 text-primary" strokeWidth={1.5} />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cards Extracted From This Source ({cards.length})
              </h2>
            </div>
            {cards.length === 0 ? (
              <p className="text-xs text-muted-foreground">No cards extracted from this source yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {cards.map((cardMap) => {
                  const slug = Object.keys(cardMap)[0] || "";
                  const title = cardMap[slug] || slug;
                  return (
                    <Link
                      key={slug}
                      to="/c/$slug"
                      params={{ slug }}
                      className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-surface-sunken px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      <span className="size-1.5 rounded-full bg-primary" />
                      <span>{title}</span>
                      <span className="font-mono text-2xs text-muted-foreground">/c/{slug}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Transcript, Mentions, Summary */}
        <div className="flex flex-col gap-5">
          {/* Summary if present */}
          {source.summary && (
            <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={SparklesIcon} className="size-4 text-primary" strokeWidth={1.5} />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Summary
                </h2>
              </div>
              <p className="text-xs leading-relaxed text-foreground">{source.summary}</p>
            </div>
          )}

          {/* Transcript with Interactive Seekable Stamps */}
          {transcriptChunks.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={TextIcon} className="size-4 text-primary" strokeWidth={1.5} />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Transcript
                  </h2>
                </div>
                <span className="text-2xs text-muted-foreground">Click stamp to seek</span>
              </div>
              <div className="mt-2 max-h-80 overflow-y-auto pr-1 text-xs leading-relaxed text-foreground" data-lenis-prevent>
                {transcriptChunks.map((chunk, index) => {
                  if (chunk.type === "stamp") {
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSeek(chunk.seconds)}
                        className="mx-1 inline-flex items-center gap-0.5 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.2 font-mono text-2xs font-semibold text-primary transition-colors hover:bg-primary/20"
                        title={`Seek to ${chunk.raw}`}
                      >
                        <HugeiconsIcon icon={Clock01Icon} className="size-2.5" strokeWidth={1.5} />
                        <span>{chunk.raw}</span>
                      </button>
                    );
                  }
                  return <span key={index}>{chunk.text}</span>;
                })}
              </div>
            </div>
          )}

          {/* Mentions */}
          {mentions.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mentions ({mentions.length})
              </h2>
              <div className="flex flex-col gap-2 pt-1">
                {mentions.map((m, idx) => {
                  const stampSecs = m.at ? parseStamp(m.at) : null;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-sunken p-2.5 text-xs"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground truncate">{m.name}</span>
                          <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-2xs text-muted-foreground">
                            {m.kind}
                          </span>
                        </div>
                        {m.url && (
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-2xs text-muted-foreground hover:text-primary truncate"
                          >
                            {m.url}
                          </a>
                        )}
                      </div>

                      {stampSecs !== null && (
                        <button
                          type="button"
                          onClick={() => handleSeek(stampSecs)}
                          className="flex shrink-0 items-center gap-1 rounded border border-border/60 bg-background px-2 py-1 font-mono text-2xs font-medium text-foreground hover:border-primary/50"
                          title={`Seek video to ${m.at}`}
                        >
                          <HugeiconsIcon icon={Clock01Icon} className="size-3 text-primary" strokeWidth={1.5} />
                          <span>{m.at}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* On-Screen Text */}
          {onScreenTexts.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                On-Screen Text
              </h2>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {onScreenTexts.map((txt, idx) => (
                  <span
                    key={idx}
                    className="rounded-md border border-border/60 bg-surface-sunken px-2 py-1 text-2xs font-medium text-muted-foreground"
                  >
                    {txt}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
