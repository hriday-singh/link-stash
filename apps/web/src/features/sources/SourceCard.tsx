import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Video01Icon } from "@hugeicons/core-free-icons";
import { BrandLogo } from "@/components/BrandLogo";
import type { SourceRow } from "@/api/client";
import { stageLabel } from "./filters";

export function SourceCard({ source }: { source: SourceRow }) {
  const stageColor =
    source.stage === "triaged"
      ? "bg-success/15 text-success border-success/30"
      : source.stage === "analyzed"
        ? "bg-warning/15 text-warning border-warning/30"
        : "bg-muted text-muted-foreground border-border/60";

  return (
    <Link
      to="/s/$sourceId"
      params={{ sourceId: source.id }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs transition-all duration-(--duration-base) hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      {/* Thumbnail Aspect 16:9 */}
      <div className="relative aspect-video w-full overflow-hidden bg-surface-sunken">
        {source.thumb_url ? (
          <img
            src={source.thumb_url}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-(--duration-slow) group-hover:scale-102"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
            <BrandLogo brand={source.platform} size={28} className="text-foreground/60" />
            <span className="font-mono text-2xs truncate max-w-full">
              {source.creator || source.platform}
            </span>
          </div>
        )}

        {/* Video Badge */}
        {source.has_video && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-background/85 px-1.5 py-0.5 text-2xs font-medium text-foreground backdrop-blur-xs border border-border/40">
            <HugeiconsIcon icon={Video01Icon} className="size-3 text-primary" strokeWidth={1.5} />
            <span>Video</span>
          </div>
        )}

        {/* Stage Badge */}
        <div className="absolute top-2 left-2">
          <span
            className={`rounded-md border px-1.5 py-0.5 font-mono text-2xs font-medium uppercase tracking-wider backdrop-blur-xs ${stageColor}`}
          >
            {stageLabel(source.stage)}
          </span>
        </div>
      </div>

      {/* Card Info */}
      <div className="flex flex-1 flex-col justify-between gap-3 p-3.5">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <BrandLogo brand={source.platform} size={12} />
            <span className="font-medium text-foreground/80 truncate">{source.platform}</span>
            {source.creator && (
              <>
                <span>·</span>
                <span className="truncate text-primary font-medium">{source.creator}</span>
              </>
            )}
          </div>
          <h3 className="line-clamp-2 text-xs font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary transition-colors">
            {source.url}
          </h3>
        </div>

        <div className="flex items-center justify-between text-2xs text-muted-foreground pt-1 border-t border-border/40">
          <span className="min-w-0 truncate font-mono text-2xs">{source.id}</span>
          {source.fetched_at && (
            <time dateTime={source.fetched_at} className="shrink-0">
              {new Date(source.fetched_at).toLocaleDateString()}
            </time>
          )}
        </div>
      </div>
    </Link>
  );
}
