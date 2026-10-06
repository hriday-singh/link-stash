export interface HeaderRow {
  type: "header";
  id: string;
  title: string;
  count: number;
}

export interface TilesRow<T> {
  type: "tiles";
  id: string;
  items: T[];
}

export type GridRow<T> = HeaderRow | TilesRow<T>;

/**
 * Calculates number of columns based on container width.
 * Responsive breakpoints:
 * - < 640px: 1 column
 * - 640px - 1023px: 2 columns
 * - 1024px - 1279px: 3 columns
 * - >= 1280px: 4 columns
 */
export function columnsForWidth(width: number): number {
  if (width < 640) return 1;
  if (width < 1024) return 2;
  if (width < 1280) return 3;
  return 4;
}

function parseDayKey(dateStr?: string): { dayKey: string; title: string } {
  if (!dateStr) return { dayKey: "unknown", title: "Earlier" };

  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return { dayKey: "unknown", title: "Earlier" };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffDays = Math.round(
      (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24),
    );

    const dayKey = date.toISOString().slice(0, 10);

    if (diffDays === 0) return { dayKey, title: "Today" };
    if (diffDays === 1) return { dayKey, title: "Yesterday" };

    const formatted = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
    return { dayKey, title: formatted };
  } catch {
    return { dayKey: "unknown", title: "Earlier" };
  }
}

/**
 * Builds rows for the virtualized grid.
 * Either groups items into day headers + tile rows, or produces straight tile rows.
 */
export function buildRows<T extends { added?: string; date?: string; id?: string; slug?: string }>(
  items: T[],
  cols: number,
  groupByDay = true,
): GridRow<T>[] {
  const safeCols = Math.max(1, cols);
  if (!items.length) return [];

  if (!groupByDay) {
    const rows: GridRow<T>[] = [];
    for (let i = 0; i < items.length; i += safeCols) {
      const chunk = items.slice(i, i + safeCols);
      rows.push({
        type: "tiles",
        id: `row-${i}`,
        items: chunk,
      });
    }
    return rows;
  }

  // Group by day key
  const groups = new Map<string, { title: string; items: T[] }>();

  for (const item of items) {
    const dateStr = item.added || item.date;
    const { dayKey, title } = parseDayKey(dateStr);
    const existing = groups.get(dayKey);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(dayKey, { title, items: [item] });
    }
  }

  const result: GridRow<T>[] = [];

  for (const [dayKey, group] of groups.entries()) {
    result.push({
      type: "header",
      id: `header-${dayKey}`,
      title: group.title,
      count: group.items.length,
    });

    for (let i = 0; i < group.items.length; i += safeCols) {
      const chunk = group.items.slice(i, i + safeCols);
      result.push({
        type: "tiles",
        id: `tiles-${dayKey}-${i}`,
        items: chunk,
      });
    }
  }

  return result;
}
