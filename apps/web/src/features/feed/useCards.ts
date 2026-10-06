import { useInfiniteQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import { queryKeys } from "@/api/keys";
import type { components } from "@/api/schema";
import type { TileData } from "@/components/Tile";
import type { CardFilters } from "@/features/search/filters";

export type CardTileApi = components["schemas"]["CardTile"];

export interface CardTileItem extends TileData {
  added: string;
  hash: string;
  url?: string | null;
}

export function toTileItem(card: CardTileApi): CardTileItem {
  return {
    slug: card.slug,
    key: card.key,
    title: card.title,
    category: card.category,
    categoryColor: `cat-${card.category}`,
    kind: card.kind,
    thumbUrl: card.thumb_url ?? null,
    platform: card.platform ?? null,
    bucket: card.bucket ?? null,
    added: card.added,
    hash: card.hash,
    url: card.url,
  };
}

export function useCards(filters: CardFilters = {}) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.cards(filters as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      const response = await unwrap(
        api.GET("/api/cards", {
          params: {
            query: {
              category: filters.category,
              kind: filters.kind,
              tag: filters.tag,
              bucket: filters.bucket,
              creator: filters.creator,
              since: filters.since,
              until: filters.until,
              has_video: filters.has_video,
              cursor: pageParam,
              limit: 50,
            },
          },
        }),
      );
      return response;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? null,
    staleTime: 1000 * 30,
  });

  const items: CardTileItem[] =
    query.data?.pages.flatMap((page) => page.items.map(toTileItem)) ?? [];

  return {
    ...query,
    items,
  };
}
