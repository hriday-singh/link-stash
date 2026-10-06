import type { ReactNode } from "react";
import { BUCKET_LABELS, type Bucket } from "@/lib/buckets";
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
  bucket?: Bucket | null;
}

/** Fixed shape: 4:3 media, 2-line title slot, meta row pinned to the bottom. Fills its grid cell. */
export function Tile({ data, badge }: { data: TileData; badge?: ReactNode }) {
  const transitionName = `card-${data.slug.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-[translate,box-shadow] duration-(--duration-base) ease-out hover:-translate-y-0.5 hover:shadow-md">
      <div
        style={{ viewTransitionName: transitionName } as React.CSSProperties}
        className="relative aspect-[4/3] shrink-0 overflow-hidden bg-muted"
      >
        {data.thumbUrl ? (
          <img
            src={data.thumbUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <GeneratedTile data={data} />
        )}
        {badge && <div className="absolute top-2 right-2">{badge}</div>}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <h3 className="line-clamp-2 min-h-10 break-words text-sm font-medium">{data.title}</h3>
        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <CategoryPill name={data.category} color={data.categoryColor} />
            {data.bucket && (
              <span className="truncate rounded-full border px-1.5 py-0.5 text-2xs text-muted-foreground">
                {BUCKET_LABELS[data.bucket]}
              </span>
            )}
          </div>
          {data.platform && (
            <span className="truncate text-2xs text-muted-foreground capitalize">
              {data.platform}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
