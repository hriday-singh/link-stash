import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Video01Icon, FilterIcon, Cancel01Icon, Copy01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { api, unwrap, type PageSourceRow } from "@/api/client";
import { queryKeys } from "@/api/keys";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SourceCard } from "./SourceCard";
import { STAGES, STAGE_LABELS, type SourceFilters } from "./filters";

// "other" = any platform not listed here; the API maps it to NOT IN.
const PLATFORMS = [
  { value: "", label: "All" },
  { value: "instagram", label: "Instagram" },
  { value: "github", label: "GitHub" },
  { value: "huggingface", label: "Hugging Face" },
  { value: "other", label: "Other" },
];

const STAGE_OPTIONS = [
  { value: "", label: "Any stage" },
  ...STAGES.map((value) => ({ value, label: STAGE_LABELS[value] })),
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
        }),
      );
    },
  });

  const sources = data?.items ?? [];
  const hasActiveFilters = Boolean(
    filters.platform || filters.stage || filters.creator || filters.has_video,
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

  // One /stash command for every source on screen, so a filtered set (e.g. New) can be re-run.
  const copyStashCommand = () => {
    const command = `/stash ${sources.map((src) => src.url).join(" ")}`;
    navigator.clipboard.writeText(command).then(
      () => toast.success(`Copied /stash command for ${sources.length} sources`),
      () => toast.error("Could not copy the command"),
    );
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
          <SegmentedControl
            value={filters.platform ?? ""}
            onChange={(v) => updateFilters({ platform: v || undefined })}
            options={PLATFORMS}
            aria-label="Platform filter"
            className="flex-wrap"
          />
          <SegmentedControl
            value={filters.stage ?? ""}
            onChange={(v) => updateFilters({ stage: v || undefined })}
            options={STAGE_OPTIONS}
            aria-label="Stage filter"
            className="flex-wrap"
          />
          <Button
            variant="outline"
            size="sm"
            aria-pressed={Boolean(filters.has_video)}
            onClick={() => updateFilters({ has_video: !filters.has_video })}
            className={`h-8 gap-1.5 text-xs ${
              filters.has_video
                ? "border-primary/50 bg-primary/10 text-primary"
                : "text-muted-foreground"
            }`}
          >
            <HugeiconsIcon icon={Video01Icon} strokeWidth={1.5} />
            Has video
          </Button>
          {sources.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={copyStashCommand}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={Copy01Icon} strokeWidth={1.5} />
              Copy /stash ({sources.length})
            </Button>
          )}

          <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <Input
              placeholder="Filter creator (@name)..."
              value={filters.creator ?? ""}
              onChange={(e) => updateFilters({ creator: e.target.value.trim() || undefined })}
              className="h-8 w-full text-xs bg-surface-sunken/60 sm:w-44"
            />
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={1.5} />
                Clear
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
          <HugeiconsIcon
            icon={FilterIcon}
            className="size-8 text-muted-foreground/60"
            strokeWidth={1.5}
          />
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
