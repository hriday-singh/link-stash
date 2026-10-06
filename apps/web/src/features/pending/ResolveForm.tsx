import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkBadge01Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function isValidHttpUrl(urlStr: string): boolean {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

interface ResolveFormProps {
  itemId: string;
  isResolving: boolean;
  onResolve: (url: string) => Promise<void>;
}

export function ResolveForm({ itemId, isResolving, onResolve }: ResolveFormProps) {
  const [url, setUrl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();

    if (!isValidHttpUrl(trimmed)) {
      setError("Please enter a valid http(s) URL.");
      return;
    }

    setError(null);
    await onResolve(trimmed);
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-1.5 pt-1">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="url"
          placeholder="Paste received DM link (https://...)"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          disabled={isResolving}
          aria-label={`Destination URL for ${itemId}`}
          className="h-8 flex-1 min-w-60 text-xs bg-surface-sunken/60"
        />
        <Button
          type="submit"
          size="sm"
          disabled={isResolving || !url.trim()}
          className="h-8 px-3 text-xs gap-1.5 shrink-0"
        >
          {isResolving ? (
            <HugeiconsIcon icon={Loading03Icon} className="size-3.5 animate-spin" strokeWidth={1.5} />
          ) : (
            <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-3.5" strokeWidth={1.5} />
          )}
          <span>{isResolving ? "Resolving…" : "Resolve & Save"}</span>
        </Button>
      </div>

      {error && (
        <p data-testid="resolve-error" className="text-2xs font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
