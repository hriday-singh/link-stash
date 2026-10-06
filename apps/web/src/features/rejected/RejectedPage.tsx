import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowReloadHorizontalIcon, Loading03Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { LazyMotion, domAnimation, AnimatePresence, m, useReducedMotion } from "motion/react";
import { api, ApiError, unwrap, type RejectEntry } from "@/api/client";
import { queryKeys } from "@/api/keys";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

export function RejectedPage() {
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();
  const [unrejectingKey, setUnrejectingKey] = React.useState<string | null>(null);

  const {
    data: rejects,
    isLoading,
    isError,
  } = useQuery<RejectEntry[]>({
    queryKey: queryKeys.rejects(),
    queryFn: async () => {
      return await unwrap(api.GET("/api/rejects"));
    },
  });

  const handleUnreject = async (key: string) => {
    setUnrejectingKey(key);
    try {
      await unwrap(
        api.DELETE("/api/rejects/{key}", {
          params: { path: { key } },
        }),
      );
      toast.success("Removed from rejected log. Item can be suggested again.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Spec & review focus: 404 handled as a quiet refresh (CLI or another session already removed it).
        // No error toast.
      } else {
        const message = err instanceof Error ? err.message : "Failed to un-reject item";
        toast.error(message);
      }
    } finally {
      // Refresh list quietly
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.rejects() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.meta() }),
      ]);
      setUnrejectingKey(null);
    }
  };

  const rejectList = rejects ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Rejected log (${rejectList.length})`}
        description="Rejected links and cards are skipped during triage and never suggested again."
      />

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-border/40 bg-surface-sunken"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center text-xs text-destructive">
          Failed to load rejected log from Link Stash server.
        </div>
      ) : rejectList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
          No rejected items.
        </div>
      ) : (
        <LazyMotion features={domAnimation}>
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {rejectList.map((entry) => {
                const isProcessing = unrejectingKey === entry.key;
                return (
                  <m.div
                    key={entry.key}
                    layout={shouldReduceMotion ? false : "position"}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-xs transition-colors hover:border-border"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground truncate max-w-full">
                          {entry.key}
                        </span>
                        <span className="font-mono text-2xs text-muted-foreground">·</span>
                        <span className="font-mono text-2xs text-muted-foreground">
                          {entry.date}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground leading-normal">{entry.reason}</p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => handleUnreject(entry.key)}
                      className="h-8 shrink-0 gap-1.5 px-3 text-xs"
                    >
                      {isProcessing ? (
                        <HugeiconsIcon
                          icon={Loading03Icon}
                          className="size-3.5 animate-spin"
                          strokeWidth={1.5}
                        />
                      ) : (
                        <HugeiconsIcon
                          icon={ArrowReloadHorizontalIcon}
                          className="size-3.5"
                          strokeWidth={1.5}
                        />
                      )}
                      <span>Un-reject</span>
                    </Button>
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
