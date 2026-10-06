import type { ReactNode } from "react";
import { TextMorph } from "@/components/ui/TextMorph";

/** Shared page title row: every view uses this so headings line up across pages. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight" aria-label={title}>
          <TextMorph>{title}</TextMorph>
        </h1>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
