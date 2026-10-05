import type { CSSProperties } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { categoryColorVar } from "@/lib/categories";
import { generatedLabel, KIND_ICON } from "@/lib/kinds";
import type { TileData } from "./Tile";

export function GeneratedTile({
  data,
}: {
  data: Pick<TileData, "key" | "title" | "kind" | "categoryColor">;
}) {
  const [primary, secondary] = generatedLabel(data.key, data.title);
  return (
    <div
      data-testid="generated-tile"
      className="tile-tint flex size-full flex-col justify-end gap-2 p-4"
      style={{ "--tint": categoryColorVar(data.categoryColor) } as CSSProperties}
    >
      <HugeiconsIcon
        icon={KIND_ICON[data.kind]}
        className="size-7 text-foreground/70"
        strokeWidth={1.5}
        aria-hidden
      />
      {secondary && <p className="truncate font-mono text-xs text-muted-foreground">{secondary}</p>}
      <p className="line-clamp-3 break-words text-lg font-semibold leading-snug">{primary}</p>
    </div>
  );
}
