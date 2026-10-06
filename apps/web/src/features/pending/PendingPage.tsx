import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Comment01Icon,
  CheckmarkCircle02Icon,
  Alert02Icon,
  Delete02Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { LazyMotion, domAnimation, AnimatePresence, m, useReducedMotion } from "motion/react";
import { api, unwrap, type PendingItem } from "@/api/client";
import { queryKeys } from "@/api/keys";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ResolveForm } from "./ResolveForm";

export function PendingPage() {
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();
  const [resolvingId, setResolvingId] = React.useState<string | null>(null);

  const {
    data: items,
    isLoading,
    isError,
  } = useQuery<PendingItem[]>({
    queryKey: queryKeys.pending(),
    queryFn: async () => {
      return await unwrap(api.GET("/api/pending"));
    },
  });

  const handleResolve = async (id: string, url: string) => {
    setResolvingId(id);
    try {
      await unwrap(
        api.POST("/api/pending/{id}/resolve", {
          params: { path: { id } },
          body: { url },
        }),
      );
      toast.success("Resolved pending link. Will be triaged on next /stash run.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.pending() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.meta() }),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resolve item";
      toast.error(message);
    } finally {
      setResolvingId(null);
    }
  };

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.pending() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.meta() }),
    ]);

  const handleRecheck = async (id: string) => {
    setResolvingId(id);
    try {
      const res = await unwrap(api.POST("/api/pending/{id}/recheck", { params: { path: { id } } }));
      if (res.status === "failed") toast.error("Still blocked. Save the reel manually.");
      else toast.success("Fetched. Will be triaged on next /stash run.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recheck failed");
    } finally {
      setResolvingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setResolvingId(id);
    try {
      await unwrap(api.DELETE("/api/pending/{id}", { params: { path: { id } } }));
      toast.success("Removed from pending.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setResolvingId(null);
    }
  };

  const pendingList = items ?? [];
  const openCount = pendingList.filter((i) => i.status === "open").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Pending resolution (${openCount})`}
        description="Reels and sources that need follow-up links. Paste the link once received."
      />

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-border/40 bg-surface-sunken"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center text-xs text-destructive">
          Failed to load pending items from Link Stash server.
        </div>
      ) : pendingList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
          No pending link requests.
        </div>
      ) : (
        <LazyMotion features={domAnimation}>
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {pendingList.map((item) => {
                const isOpen = item.status === "open";
                return (
                  <m.div
                    key={item.id}
                    layout={shouldReduceMotion ? false : "position"}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
                    className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs transition-colors hover:border-border"
                  >
                    {/* Meta row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md border px-2 py-0.5 font-mono text-2xs uppercase tracking-wider ${
                            item.kind === "blocked"
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : "border-warning/30 bg-warning/10 text-warning"
                          }`}
                        >
                          {item.kind}
                        </span>

                        <span
                          className={`rounded-md border px-2 py-0.5 font-mono text-2xs uppercase tracking-wider ${
                            isOpen
                              ? "border-border/60 bg-muted/60 text-muted-foreground"
                              : "border-success/30 bg-success/15 text-success font-semibold"
                          }`}
                        >
                          {item.status}
                        </span>

                        {item.source_key && (
                          <Link
                            to="/s/$sourceId"
                            params={{ sourceId: item.source_key }}
                            className="font-mono text-2xs text-primary hover:underline"
                          >
                            {item.source_key}
                          </Link>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="mr-1 font-mono text-2xs text-muted-foreground">
                          {item.added}
                        </span>
                        {item.kind === "blocked" && isOpen && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={resolvingId === item.id}
                            onClick={() => handleRecheck(item.id)}
                            className="gap-1 text-xs"
                          >
                            <HugeiconsIcon icon={RefreshIcon} strokeWidth={1.5} />
                            Recheck
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={resolvingId === item.id}
                          onClick={() => handleDelete(item.id)}
                          className="gap-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete ${item.id}`}
                        >
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.5} />
                          Delete
                        </Button>
                      </div>
                    </div>

                    {/* Instruction */}
                    <div className="flex items-start gap-2.5">
                      <HugeiconsIcon
                        icon={item.kind === "blocked" ? Alert02Icon : Comment01Icon}
                        className={`mt-0.5 size-4 shrink-0 ${
                          item.kind === "blocked" ? "text-destructive" : "text-warning"
                        }`}
                        strokeWidth={1.5}
                      />
                      <p className="text-xs font-medium leading-relaxed text-foreground">
                        {item.instruction}
                      </p>
                    </div>

                    {/* Form or Resolved State */}
                    {isOpen ? (
                      <ResolveForm
                        itemId={item.id}
                        isResolving={resolvingId === item.id}
                        onResolve={(url) => handleResolve(item.id, url)}
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-success/30 bg-success/5 p-2.5 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <HugeiconsIcon
                            icon={CheckmarkCircle02Icon}
                            className="size-4 shrink-0 text-success"
                            strokeWidth={1.5}
                          />
                          <span className="text-2xs text-muted-foreground">Resolved link:</span>
                          <a
                            href={item.url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-2xs text-primary hover:underline truncate"
                          >
                            {item.url}
                          </a>
                        </div>
                        <span className="shrink-0 text-2xs text-muted-foreground">
                          Ready for next /stash run
                        </span>
                      </div>
                    )}
                  </m.div>
                );
              })}
            </AnimatePresence>
          </div>
        </LazyMotion>
      )}
    </div>
  );
}
