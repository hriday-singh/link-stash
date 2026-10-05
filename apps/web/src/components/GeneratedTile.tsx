import type { CSSProperties } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { categoryColorVar } from "@/lib/categories";
import { generatedLabel, KIND_ICON } from "@/lib/kinds";
import type { TileData } from "./Tile";

/** Placeholder media for cards without a thumbnail: kind icon + source namespace, never the title. */
export function GeneratedTile({
  data,
}: {
  data: Pick<TileData, "key" | "title" | "kind" | "categoryColor">;
}) {
  const [, namespace] = generatedLabel(data.key, data.title);
  return (
    <div
      data-testid="generated-tile"
      className="tile-tint flex size-full flex-col items-center justify-center gap-2 p-4 text-center"
      style={{ "--tint": categoryColorVar(data.categoryColor) } as CSSProperties}
    >
      <HugeiconsIcon
        icon={KIND_ICON[data.kind]}
        className="size-8 text-foreground/70"
        strokeWidth={1.5}
        aria-hidden
      />
      <p className="max-w-full truncate font-mono text-2xs text-muted-foreground">
        {namespace ? `${data.kind} · ${namespace}` : data.kind}
      </p>
    </div>
  );
}
