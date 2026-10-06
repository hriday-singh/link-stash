import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { buildRows, columnsForWidth, type GridRow } from "@/lib/grid";
import { Tile, type TileData } from "@/components/Tile";
import { PlatformLogo } from "@/components/ui/BrandLogo";
import { useMainScroll } from "./MainScroll";

export interface VirtualGridProps<T extends TileData & { added?: string; date?: string }> {
  items: T[];
  groupByDay?: boolean;
  emptyMessage?: string;
  emptySubtext?: string;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  renderItem?: (item: T) => ReactNode;
}

export function VirtualGrid<T extends TileData & { added?: string; date?: string }>({
  items,
  groupByDay = true,
  emptyMessage,
  emptySubtext,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  renderItem,
}: VirtualGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollElement } = useMainScroll();
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth > 0 ? window.innerWidth : 1024;
    }
    return 1024;
  });

  // Measure container width responsively
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (el.clientWidth > 0) {
      setContainerWidth(el.clientWidth);
    }

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            setContainerWidth(entry.contentRect.width);
          }
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, []);

  const cols = useMemo(() => columnsForWidth(containerWidth), [containerWidth]);
  const rows = useMemo(
    () => buildRows(items, cols, groupByDay),
    [items, cols, groupByDay],
  );

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement ?? containerRef.current,
    estimateSize: (index) => (rows[index]?.type === "header" ? 44 : 330),
    overscan: 2,
    initialRect: { width: containerWidth || 1024, height: 800 },
  });

  // Trigger infinite loading when approaching the end of the rows
  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];

  // In zero-height environments (like jsdom/testing), provide a fallback so items render
  const displayRows =
    virtualItems.length > 0
      ? virtualItems
      : rows.map((_, index) => ({
          index,
          start: index === 0 ? 0 : 44 + (index - 1) * 330,
          size: rows[index]?.type === "header" ? 44 : 330,
          end: index === 0 ? 44 : 44 + index * 330,
          key: index,
          lane: 0,
        }));

  useEffect(() => {
    if (!lastItem || !hasMore || isLoadingMore || !onLoadMore) return;
    if (lastItem.index >= rows.length - 2) {
      onLoadMore();
    }
  }, [lastItem, hasMore, isLoadingMore, onLoadMore, rows.length]);

  if (items.length === 0) {
    return (
      <div
        data-slot="grid-empty"
        className="flex min-h-[40vh] flex-col items-center justify-center p-8 text-center"
      >
        <p className="max-w-md text-sm font-medium text-foreground">
          {emptyMessage ?? "Paste links into /stash in Claude Code or agy."}
        </p>
        {emptySubtext && (
          <p className="mt-1 text-xs text-muted-foreground">{emptySubtext}</p>
        )}
      </div>
    );
  }

  const defaultRenderItem = (item: T) => (
    <Link
      key={item.slug}
      to="/c/$slug"
      params={{ slug: item.slug }}
      className="block h-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-lg"
    >
      <Tile
        data={item}
        badge={
          item.platform ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-background/80 shadow-xs backdrop-blur-xs">
              <PlatformLogo platform={item.platform} className="size-3.5 text-foreground" />
            </span>
          ) : undefined
        }
      />
    </Link>
  );

  return (
    <div ref={containerRef} data-slot="virtual-grid-container" className="relative w-full">
      <div
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        className="relative w-full"
      >
        {displayRows.map((virtualRow) => {
          const row: GridRow<T> | undefined = rows[virtualRow.index];
          if (!row) return null;

          return (
            <div
              key={row.id}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.type === "header" ? (
                <div className="flex items-center gap-2 pb-3 pt-4">
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    {row.title}
                  </h2>
                  <span className="rounded-full bg-surface-sunken px-2 py-0.5 font-mono text-2xs text-muted-foreground">
                    {row.count}
                  </span>
                </div>
              ) : (
                <div
                  className="grid gap-4 pb-4"
                  style={{
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  }}
                >
                  {row.items.map((item) => (
                    <div key={item.slug || item.key} className="h-full">
                      {renderItem ? renderItem(item) : defaultRenderItem(item)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isLoadingMore && (
        <div className="flex justify-center py-6 text-xs text-muted-foreground">
          Loading more cards…
        </div>
      )}
    </div>
  );
}
