import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Video01Icon, FilterIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { api, unwrap, type PageSourceRow } from "@/api/client";
import { queryKeys } from "@/api/keys";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SourceCard } from "./SourceCard";
import { STAGES, STAGE_LABELS, type SourceFilters } from "./filters";

const PLATFORMS = [
  { id: "", label: "All Platforms" },
  { id: "instagram", label: "Instagram" },
  { id: "github", label: "GitHub" },
  { id: "huggingface", label: "Hugging Face" },
];

const STAGE_OPTIONS = [
  { id: "", label: "All Stages" },
  ...STAGES.map((id) => ({ id, label: STAGE_LABELS[id] })),
];

interface SourcesPageProps {
  filters: SourceFilters;
}

export function SourcesPage({ filters }: SourcesPageProps) {
  const navigate = useNavigate({ from: "/sources" });

  const queryParams: Record<string, string | number | boolean | undefined> = {
    platform: filters.platform,
    creator: filters.creator,
    stage: filters.stage,
    has_video: filters.has_video,
    cursor: filters.cursor,
  };

  const { data, isLoading, isError } = useQuery<PageSourceRow>({
    queryKey: queryKeys.sources(queryParams),
    queryFn: async () => {
      return await unwrap(
        api.GET("/api/sources", {
          params: {
            query: {
              platform: filters.platform,
              creator: filters.creator,
              stage: filters.stage,
              has_video: filters.has_video,
              cursor: filters.cursor,
            },
          },
        })
      );
    },
  });

  const sources = data?.items ?? [];
  const hasActiveFilters = Boolean(
    filters.platform || filters.stage || filters.creator || filters.has_video
  );

  const updateFilters = (next: Partial<SourceFilters>) => {
    navigate({
      search: (prev: Record<string, unknown>) => {
        const updated = { ...prev, ...next };
        for (const [k, v] of Object.entries(updated)) {
          if (v === undefined || v === "" || v === false) {
            delete (updated as Record<string, unknown>)[k];
          }
        }
        return updated;
      },
    });
  };

  const clearFilters = () => {
    navigate({ search: {} });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Sources ${sources.length > 0 ? `(${sources.length})` : ""}`}
        description="Original media, repositories, and feeds your cards were extracted from."
      />

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
        {/* One wrapping row: `contents` lets the pill groups wrap alongside the creator input. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="contents">
            {/* Platform pills */}
            <div className="flex flex-wrap items-center rounded-lg border border-border/60 bg-surface-sunken p-0.5 text-xs">
              {PLATFORMS.map((p) => {
                const active = (filters.platform || "") === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => updateFilters({ platform: p.id || undefined })}
                    className={`rounded-md px-2.5 py-1 text-2xs font-medium transition-colors ${
                      active
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Stage pills */}
            <div className="flex flex-wrap items-center rounded-lg border border-border/60 bg-surface-sunken p-0.5 text-xs">
              {STAGE_OPTIONS.map((s) => {
                const active = (filters.stage || "") === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => updateFilters({ stage: s.id || undefined })}
                    className={`rounded-md px-2.5 py-1 text-2xs font-medium transition-colors ${
                      active
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* Has Video toggle */}
            <button
              type="button"
              onClick={() => updateFilters({ has_video: !filters.has_video })}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-2xs font-medium transition-colors ${
                filters.has_video
                  ? "border-primary/50 bg-primary/10 text-primary font-semibold"
                  : "border-border/60 bg-surface-sunken text-muted-foreground hover:text-foreground"
              }`}
            >
              <HugeiconsIcon icon={Video01Icon} className="size-3" strokeWidth={1.5} />
              <span>Has Video</span>
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Input
              placeholder="Filter creator (@name)..."
              value={filters.creator ?? ""}
              onChange={(e) => updateFilters({ creator: e.target.value.trim() || undefined })}
              className="h-8 w-44 text-xs bg-surface-sunken/60"
            />
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 gap-1 px-2 text-2xs text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" strokeWidth={1.5} />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Grid Content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-video animate-pulse rounded-xl border border-border/40 bg-surface-sunken"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center text-xs text-destructive">
          Failed to load sources from Link Stash server.
        </div>
      ) : sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <HugeiconsIcon icon={FilterIcon} className="size-8 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="text-sm font-medium text-foreground">No sources found.</p>
          <p className="text-xs">
            {hasActiveFilters
              ? "No sources matched your current filters."
              : "Sources will appear here once links are extracted."}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2 text-xs">
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sources.map((src) => (
            <SourceCard key={src.id} source={src} />
          ))}
        </div>
      )}
    </div>
  );
}
