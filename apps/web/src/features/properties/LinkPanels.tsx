import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  LinkSquare02Icon,
  Video01Icon,
  HelpCircleIcon,
  Archive02Icon,
} from "@hugeicons/core-free-icons";
import { BrandLogo } from "@/components/BrandLogo";
import type { CardLinks } from "@/api/client";

export interface LinkPanelsProps {
  links?: CardLinks | null;
  isLoading?: boolean;
}

export function LinkPanels({ links, isLoading = false }: LinkPanelsProps) {
  if (isLoading) {
    return (
      <div
        data-testid="link-panels-loading"
        className="space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-xs text-xs animate-pulse"
      >
        <div className="h-4 w-24 rounded bg-muted/60" />
        <div className="space-y-2">
          <div className="h-3 w-3/4 rounded bg-muted/40" />
          <div className="h-3 w-1/2 rounded bg-muted/40" />
        </div>
      </div>
    );
  }

  const backlinks = links?.backlinks ?? [];
  const mentionedBy = links?.mentioned_by ?? [];
  const outgoing = links?.outgoing ?? [];

  return (
    <div
      data-testid="link-panels"
      className="space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-xs text-xs"
    >
      <div className="flex items-center gap-1.5 font-semibold text-foreground">
        <HugeiconsIcon icon={LinkSquare02Icon} className="size-3.5 text-primary" strokeWidth={1.5} />
        <span className="text-2xs uppercase tracking-wider text-muted-foreground">Connections</span>
      </div>

      {/* 1. Backlinks */}
      <section className="space-y-2">
        <div className="flex items-center justify-between text-2xs font-medium text-foreground">
          <span>Backlinks ({backlinks.length})</span>
        </div>
        {backlinks.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No backlinks point here.</p>
        ) : (
          <ul className="space-y-1.5">
            {backlinks.map((link, idx) => {
              const slug = link.slug || `backlink-${idx}`;
              return (
                <li key={slug} className="flex items-center justify-between gap-2">
                  <Link
                    to="/c/$slug"
                    params={{ slug: link.slug }}
                    className="truncate font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    {link.title || link.slug}
                  </Link>
                  {link.type === "overlap" && (
                    <span className="shrink-0 rounded bg-muted px-1 py-0.2 text-[9px] font-mono text-muted-foreground">
                      overlap
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 2. Mentioned By (Sources) */}
      <section className="space-y-2 border-t border-border/50 pt-3">
        <div className="flex items-center justify-between text-2xs font-medium text-foreground">
          <span>Mentioned By ({mentionedBy.length})</span>
        </div>
        {mentionedBy.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No source mentions.</p>
        ) : (
          <ul className="space-y-2">
            {mentionedBy.map((src) => {
              const creatorLabel = src.creator ? `@${src.creator}` : src.platform || src.id;
              return (
                <li key={src.id}>
                  <Link
                    to="/s/$sourceId"
                    params={{ sourceId: src.id }}
                    className="group flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    <div className="relative size-8 shrink-0 overflow-hidden rounded border border-border/60 bg-muted flex items-center justify-center">
                      <img
                        src={`/api/sources/${src.id}/thumb`}
                        alt=""
                        className="size-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                      <HugeiconsIcon
                        icon={Video01Icon}
                        className="size-3.5 text-muted-foreground"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {src.platform && <BrandLogo brand={src.platform} size={14} />}
                        <span className="truncate font-medium text-foreground group-hover:text-primary">
                          {creatorLabel}
                        </span>
                      </div>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {src.id}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 3. Outgoing Links */}
      <section className="space-y-2 border-t border-border/50 pt-3">
        <div className="flex items-center justify-between text-2xs font-medium text-foreground">
          <span>Outgoing Links ({outgoing.length})</span>
        </div>
        {outgoing.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No outgoing links.</p>
        ) : (
          <ul className="space-y-1.5">
            {outgoing.map((out, idx) => {
              const isResolved = Boolean(out.slug && out.slug.trim().length > 0);
              const label = out.title || out.slug || out.target;
              const isInventoryOverlap =
                out.type === "overlap" || out.target?.startsWith("tool:") || out.target?.startsWith("model:");

              if (isResolved) {
                return (
                  <li key={`${out.slug}-${idx}`} className="flex items-center justify-between gap-2">
                    <Link
                      to="/c/$slug"
                      params={{ slug: out.slug }}
                      className="truncate font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
                    >
                      {label}
                    </Link>
                    {out.type === "overlap" && (
                      <span className="shrink-0 rounded bg-muted px-1 py-0.2 text-[9px] font-mono text-muted-foreground">
                        overlap
                      </span>
                    )}
                  </li>
                );
              }

              // Unresolved wikilink or inventory item (rendered as text, never broken link)
              return (
                <li
                  key={`${out.target}-${idx}`}
                  className="flex items-center justify-between gap-2 text-muted-foreground"
                >
                  <span className="flex items-center gap-1.5 truncate text-[11px]">
                    <HugeiconsIcon
                      icon={isInventoryOverlap ? Archive02Icon : HelpCircleIcon}
                      className="size-3 shrink-0 opacity-60"
                      strokeWidth={1.5}
                    />
                    <span className="truncate">{out.target || label}</span>
                  </span>
                  <span className="shrink-0 rounded bg-muted/70 px-1 py-0.2 text-[9px] font-mono text-muted-foreground">
                    {isInventoryOverlap ? "inventory" : "unresolved"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
