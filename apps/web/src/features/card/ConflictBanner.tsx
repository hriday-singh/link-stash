import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, RefreshIcon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

export interface ConflictBannerProps {
  onReload: () => void;
  onKeepMine: () => void;
  isSaving?: boolean;
  className?: string;
}

export function ConflictBanner({
  onReload,
  onKeepMine,
  isSaving = false,
  className = "",
}: ConflictBannerProps) {
  return (
    <div
      role="alert"
      data-testid="conflict-banner"
      className={`rounded-lg border border-warning/40 bg-warning/10 p-4 text-xs text-foreground shadow-xs ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <div className="rounded-full bg-warning/20 p-1 text-warning shrink-0 mt-0.5">
            <HugeiconsIcon icon={Alert02Icon} className="size-4" strokeWidth={2} />
          </div>
          <div className="space-y-0.5">
            <h4 className="font-semibold text-foreground text-xs">
              Concurrent Edit Conflict (409)
            </h4>
            <p className="text-foreground/80 leading-relaxed text-xs">
              This card was modified on disk or via CLI while you were editing. How would you like
              to proceed?
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 sm:self-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReload}
            disabled={isSaving}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
            Reload from disk
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onKeepMine}
            disabled={isSaving}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
            {isSaving ? "Saving…" : "Keep mine"}
          </Button>
        </div>
      </div>
    </div>
  );
}
