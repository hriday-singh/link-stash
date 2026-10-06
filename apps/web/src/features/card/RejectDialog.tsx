import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardTitle: string;
  onConfirmReject: (reason: string) => Promise<void> | void;
  isRejecting?: boolean;
}

export function RejectDialog({
  open,
  onOpenChange,
  cardTitle,
  onConfirmReject,
  isRejecting = false,
}: RejectDialogProps) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setReason("");
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setError("Please provide a reason for rejecting this card.");
      return;
    }

    setError(null);
    await onConfirmReject(cleanReason);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Reject Card</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject &ldquo;{cardTitle}&rdquo;? It will be moved to the
              rejected log and won&apos;t appear in your library or suggestions.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-2">
            <label htmlFor="reject-reason" className="text-xs font-medium text-foreground">
              Reason for rejection <span className="text-destructive">*</span>
            </label>
            <textarea
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Not relevant, outdated library, poor documentation…"
              disabled={isRejecting}
              className="w-full rounded-lg border border-border bg-surface-sunken p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-hidden focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
            {error && <p className="text-xs text-destructive font-medium">{error}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" size="sm" disabled={isRejecting}>
              {isRejecting ? "Rejecting…" : "Reject Card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
