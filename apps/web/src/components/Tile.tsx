import type { ReactNode } from "react";
import type { Kind } from "@/lib/kinds";
import { CategoryPill } from "./CategoryPill";
import { GeneratedTile } from "./GeneratedTile";

export interface TileData {
  slug: string;
  key: string;
  title: string;
  category: string;
  categoryColor: string;
  kind: Kind;
  thumbUrl: string | null;
  platform: string | null;
}

export function Tile({ data, badge }: { data: TileData; badge?: ReactNode }) {
  return (
    <article className="group overflow-hidden rounded-lg border bg-card shadow-sm transition-[translate,box-shadow] duration-(--duration-base) ease-out hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/5] bg-muted">
        {data.thumbUrl ? (
          <img
            src={data.thumbUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <GeneratedTile data={data} />
        )}
        {badge && <div className="absolute top-2 right-2">{badge}</div>}
      </div>
      <div className="flex flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 break-words text-sm font-medium">{data.title}</h3>
        <CategoryPill name={data.category} color={data.categoryColor} />
      </div>
    </article>
  );
}
