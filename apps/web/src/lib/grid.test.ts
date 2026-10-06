import { describe, expect, it } from "vitest";
import { buildRows, columnsForWidth } from "./grid";

describe("grid helpers", () => {
  it("calculates columns for responsive widths", () => {
    expect(columnsForWidth(375)).toBe(1);
    expect(columnsForWidth(639)).toBe(1);
    expect(columnsForWidth(640)).toBe(2);
    expect(columnsForWidth(1023)).toBe(2);
    expect(columnsForWidth(1024)).toBe(3);
    expect(columnsForWidth(1279)).toBe(3);
    expect(columnsForWidth(1280)).toBe(4);
    expect(columnsForWidth(1920)).toBe(4);
  });

  it("builds flat tile rows when groupByDay is false", () => {
    const items = [
      { slug: "item-1" },
      { slug: "item-2" },
      { slug: "item-3" },
      { slug: "item-4" },
      { slug: "item-5" },
    ];

    const rows = buildRows(items, 2, false);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      type: "tiles",
      id: "row-0",
      items: [{ slug: "item-1" }, { slug: "item-2" }],
    });
    expect(rows[2].type).toBe("tiles");
    if (rows[2].type === "tiles") {
      expect(rows[2].items).toEqual([{ slug: "item-5" }]);
    }
  });

  it("groups items by day and creates headers and chunks", () => {
    const today = new Date().toISOString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString();

    const items = [
      { slug: "today-1", added: today },
      { slug: "today-2", added: today },
      { slug: "today-3", added: today },
      { slug: "yesterday-1", added: yesterday },
    ];

    const rows = buildRows(items, 2, true);
    // Expected:
    // 1. Header: Today
    // 2. Tiles: [today-1, today-2]
    // 3. Tiles: [today-3]
    // 4. Header: Yesterday
    // 5. Tiles: [yesterday-1]
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({
      type: "header",
      id: expect.stringContaining("header-"),
      title: "Today",
      count: 3,
    });
    expect(rows[1].type).toBe("tiles");
    expect(rows[3]).toEqual({
      type: "header",
      id: expect.stringContaining("header-"),
      title: "Yesterday",
      count: 1,
    });
  });

  it("returns empty array for empty items", () => {
    expect(buildRows([], 3)).toEqual([]);
  });
});
