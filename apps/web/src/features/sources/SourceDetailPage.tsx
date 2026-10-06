import * as React from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft02Icon,
  LinkSquare02Icon,
  Layers01Icon,
  Clock01Icon,
  TextIcon,
  SparklesIcon,
  User02Icon,
  RefreshIcon,
  Share01Icon,
  Copy01Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, unwrap, type SourceDetail } from "@/api/client";
import { queryKeys } from "@/api/keys";
import { BrandLogo } from "@/components/BrandLogo";
import { categoryColorVar } from "@/lib/categories";
import { KIND_ICON, type Kind } from "@/lib/kinds";
import { Player, type PlayerHandle } from "./Player";
import { splitStamps, parseStamp } from "./stamps";
import { stageLabel } from "./filters";

function getCreatorUrl(platform: string, creator: string): string | null {
  const clean = creator.replace(/^@/, "").trim();
  if (!clean) return null;
  const p = platform.toLowerCase();
  if (p === "github") return `https://github.com/${clean}`;
  if (p === "instagram") return `https://instagram.com/${clean}`;
  if (p === "huggingface") return `https://huggingface.co/${clean}`;
  if (p === "twitter" || p === "x") return `https://x.com/${clean}`;
  if (p === "youtube") return `https://youtube.com/@${clean}`;
  return null;
}

export function SourceDetailPage() {
  const { sourceId } = useParams({ strict: false }) as { sourceId: string };
  const playerRef = React.useRef<PlayerHandle>(null);
  const queryClient = useQueryClient();
  const [isUpdatingStage, setIsUpdatingStage] = React.useState(false);

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
  const creatorUrl = source.creator ? getCreatorUrl(source.platform, source.creator) : null;

  const handleSeek = (seconds: number) => {
    playerRef.current?.seekTo(seconds);
  };


  const handleSetStage = async (stage: "fetched" | "analyzed" | "triaged") => {
    try {
      setIsUpdatingStage(true);
      await unwrap(
        api.PATCH("/api/sources/{id}/stage", {
          params: { path: { id: sourceId } },
          body: { stage },
        }),
      );
      toast.success(`Stage updated to ${stageLabel(stage)}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.source(sourceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sources() });
      queryClient.invalidateQueries({ queryKey: queryKeys.meta() });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update stage");
    } finally {
      setIsUpdatingStage(false);
    }
  };

  const handleRecheck = async () => {
    try {
      setIsUpdatingStage(true);
      await unwrap(
        api.POST("/api/sources/{id}/recheck", {
          params: { path: { id: sourceId } },
        }),
      );
      toast.success("Source flagged for recheck and moved back to triage queue.");
      queryClient.invalidateQueries({ queryKey: queryKeys.source(sourceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sources() });
      queryClient.invalidateQueries({ queryKey: queryKeys.meta() });

      const prompt = `/stash triage ${source.key}`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
        toast.info(`Copied agent command: ${prompt}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to flag for recheck");
    } finally {
      setIsUpdatingStage(false);
    }
  };

  const handleTriagePrompt = async () => {
    const cmd = source.stage === "fetched" ? `/stash analyze ${source.key}` : `/stash triage ${source.key}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(cmd);
        toast.success(`Copied agent command: ${cmd}`);
      }
    } catch {
      toast.error(`Run in agent: ${cmd}`);
    }
  };

  const handleShareListing = async () => {
    const title = source.creator ? `@${source.creator}` : source.platform;
    const summary = [
      `[${title}] ${source.url}`,
      `Key: ${source.key} | Stage: ${stageLabel(source.stage)}`,
      source.caption ? `\n${source.caption.slice(0, 300)}` : "",
    ].filter(Boolean).join("\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
        toast.success("Copied source listing to clipboard");
      }
    } catch {
      toast.error("Failed to copy listing");
    }
  };

  const handleCopyUrl = async () => {
    if (!source.url) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(source.url);
        toast.success("Copied source URL to clipboard");
      }
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Navigation Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/sources"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} className="size-3.5" strokeWidth={1.5} />
          <span>Back to Sources</span>
        </Link>
      </div>

      {/* Main Grid: Player & Metadata on left, Context on right */}
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
          <header className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Platform & Creator */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-surface-sunken px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <BrandLogo brand={source.platform} size={14} />
                  <span>{source.platform}</span>
                </div>

                {source.creator && (
                  <div className="flex items-center gap-1.5">
                    <Link
                      to="/sources"
                      search={{ creator: source.creator }}
                      title={`Filter stash sources by ${source.creator}`}
                      className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-xs font-medium text-primary hover:border-primary/40 hover:bg-primary/10 transition-colors"
                    >
                      <HugeiconsIcon icon={User02Icon} className="size-3" strokeWidth={1.5} />
                      <span>{source.creator}</span>
                    </Link>

                    {creatorUrl && (
                      <a
                        href={creatorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Open ${source.creator} profile on ${source.platform}`}
                        className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-surface-sunken px-2 py-1 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-muted transition-colors"
                      >
                        <span>Open User</span>
                        <HugeiconsIcon icon={LinkSquare02Icon} className="size-3 text-muted-foreground" strokeWidth={1.5} />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Status & Open Original Link */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-border/60 bg-muted/60 px-2 py-1 font-mono text-2xs uppercase tracking-wider">
                  {stageLabel(source.stage)}
                </span>

                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-surface-sunken px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted"
                  >
                    <span>Open Original</span>
                    <HugeiconsIcon icon={LinkSquare02Icon} className="size-3 text-muted-foreground" strokeWidth={1.5} />
                  </a>
                )}
              </div>
            </div>

            {source.caption && (
              <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {source.caption}
              </p>
            )}

            {/* Triage & Management Actions */}
            <div
              data-testid="source-actions-bar"
              className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border/60 bg-surface-sunken/60 p-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                {source.stage === "triaged" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="source-recheck-button"
                    disabled={isUpdatingStage}
                    onClick={handleRecheck}
                    className="h-7 gap-1.5 text-xs font-medium"
                  >
                    <HugeiconsIcon
                      icon={RefreshIcon}
                      className={`size-3.5 ${isUpdatingStage ? "animate-spin" : ""}`}
                      strokeWidth={1.5}
                    />
                    <span>Request Recheck</span>
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    data-testid="source-triage-button"
                    onClick={handleTriagePrompt}
                    className="h-7 gap-1.5 text-xs font-medium"
                  >
                    <HugeiconsIcon icon={SparklesIcon} className="size-3.5" strokeWidth={1.5} />
                    <span>{source.stage === "fetched" ? "Analyze with Agent" : "Triage with Agent"}</span>
                  </Button>
                )}

                {/* Stage selector chips */}
                <div data-testid="source-stage-selector" className="flex items-center gap-1 text-xs">
                  <span className="text-2xs text-muted-foreground mr-0.5">Stage:</span>
                  {(["fetched", "analyzed", "triaged"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={isUpdatingStage || source.stage === st}
                      onClick={() => handleSetStage(st)}
                      className={`rounded-md px-1.5 py-0.5 font-mono text-2xs transition-colors ${
                        source.stage === st
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "bg-card border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {stageLabel(st)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="source-share-button"
                  onClick={handleShareListing}
                  title="Copy shareable listing details to clipboard"
                  className="h-7 gap-1 px-2 text-2xs text-muted-foreground hover:text-foreground"
                >
                  <HugeiconsIcon icon={Share01Icon} className="size-3" strokeWidth={1.5} />
                  <span>Share</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="source-copy-url-button"
                  onClick={handleCopyUrl}
                  title="Copy source URL"
                  className="h-7 gap-1 px-2 text-2xs text-muted-foreground hover:text-foreground"
                >
                  <HugeiconsIcon icon={Copy01Icon} className="size-3" strokeWidth={1.5} />
                  <span>Copy URL</span>
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/40 pt-2 text-2xs text-muted-foreground">
              <span className="font-mono">{source.key}</span>
              {source.fetched_at && (
                <time dateTime={source.fetched_at}>
                  {new Date(source.fetched_at).toLocaleString()}
                </time>
              )}
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
                {cards.map((cardMap, index) => {
                  const cardRecord = cardMap as Record<string, string | undefined>;
                  // Handle both server payload {slug, title, category, kind} and mock dict {[slug]: title}
                  const slug =
                    cardRecord.slug ||
                    (Object.keys(cardMap)[0] !== "slug" ? Object.keys(cardMap)[0] : "") ||
                    `card-${index}`;
                  const title =
                    cardRecord.title ||
                    (cardRecord[slug] ?? (slug !== "slug" ? slug : "Untitled card"));
                  const category = cardRecord.category || "models";
                  const kind = cardRecord.kind as Kind | undefined;
                  const KindIcon = kind ? KIND_ICON[kind] || KIND_ICON.repo : null;

                  return (
                    <Link
                      key={`${slug}-${index}`}
                      to="/c/$slug"
                      params={{ slug }}
                      className="group inline-flex items-center gap-2 rounded-lg border border-border/70 bg-surface-sunken px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-card hover:text-primary hover:shadow-xs"
                    >
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: categoryColorVar(`cat-${category}`) }}
                        aria-hidden
                      />
                      {KindIcon && (
                        <HugeiconsIcon
                          icon={KindIcon}
                          className="size-3 text-muted-foreground group-hover:text-primary"
                          strokeWidth={1.5}
                        />
                      )}
                      <span className="truncate">{title}</span>
                      <span className="font-mono text-2xs text-muted-foreground group-hover:text-foreground/70">
                        /c/{slug}
                      </span>
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
