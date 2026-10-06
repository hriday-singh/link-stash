import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Wrench01Icon,
  File01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { api, unwrap, type InventoryEntry } from "@/api/client";
import { queryKeys } from "@/api/keys";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/BrandLogo";
import { groupByOrigin } from "./group";

export function InventoryPage() {
  const queryClient = useQueryClient();
  const [inputText, setInputText] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);

  const { data: items, isLoading, isError } = useQuery<InventoryEntry[]>({
    queryKey: queryKeys.inventory(),
    queryFn: async () => {
      return await unwrap(api.GET("/api/inventory"));
    },
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    setIsAdding(true);
    try {
      await unwrap(
        api.POST("/api/inventory", {
          body: { text },
        })
      );
      toast.success("Added to inventory.");
      setInputText("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.meta() }),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add inventory item";
      toast.error(message);
    } finally {
      setIsAdding(false);
    }
  };

  const inventoryItems = items ?? [];
  const groups = groupByOrigin(inventoryItems);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`System inventory (${inventoryItems.length})`}
        description="What you already have installed. New finds and recommendations are checked against it."
      />

      {/* Manual Add Card */}
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
        <form onSubmit={handleAdd} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Add tool, model, or practice... (e.g. 'vllm: high-throughput llm serving')"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isAdding}
              aria-label="New inventory entry"
              className="h-9 flex-1 min-w-64 text-xs bg-surface-sunken/60"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isAdding || !inputText.trim()}
              className="h-9 gap-1.5 px-3 text-xs shrink-0"
            >
              {isAdding ? (
                <HugeiconsIcon icon={Loading03Icon} className="size-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <HugeiconsIcon icon={Add01Icon} className="size-3.5" strokeWidth={1.5} />
              )}
              <span>{isAdding ? "Adding…" : "Add to Inventory"}</span>
            </Button>
          </div>
          <p className="text-2xs text-muted-foreground">
            Saves to <code className="font-mono">inventory/manual/tools.md</code>. Automatically checks for duplicates.
          </p>
        </form>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border/40 bg-surface-sunken"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center text-xs text-destructive">
          Failed to load inventory from Link Stash server.
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
          No inventory items recorded. Run <code className="font-mono">stash scan</code> or add items above.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                {group.brand ? (
                  <BrandLogo brand={group.brand} size={16} />
                ) : group.isAuto ? (
                  <HugeiconsIcon icon={Wrench01Icon} className="size-4 text-primary" strokeWidth={1.5} />
                ) : (
                  <HugeiconsIcon icon={File01Icon} className="size-4 text-muted-foreground" strokeWidth={1.5} />
                )}
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title} ({group.items.length})
                </h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item, idx) => (
                  <div
                    key={item.key || `${item.name}-${idx}`}
                    className="flex flex-col justify-between gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-xs transition-colors hover:border-border"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-foreground">
                          {item.name}
                        </span>
                        <span className="shrink-0 rounded-full border border-border/60 bg-surface-sunken px-1.5 py-0.2 font-mono text-2xs font-medium text-muted-foreground">
                          {item.kind}
                        </span>
                      </div>
                      <span className="truncate font-mono text-2xs text-muted-foreground">
                        {item.origin}
                      </span>
                    </div>

                    {item.key && (
                      <div className="truncate border-t border-border/30 pt-1 font-mono text-2xs text-muted-foreground/60">
                        {item.key}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
