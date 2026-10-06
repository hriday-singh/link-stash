import { describe, it, expect } from "vitest";
import { formatOriginTitle, groupByOrigin } from "./group";
import type { InventoryEntry } from "@/api/client";

describe("formatOriginTitle", () => {
  it("formats auto scanners with brand indicators", () => {
    expect(formatOriginTitle("antigravity")).toEqual({
      title: "Antigravity",
      isAuto: true,
      brand: "antigravity",
    });
    expect(formatOriginTitle("claude")).toEqual({
      title: "Claude Code",
      isAuto: true,
      brand: "claude",
    });
    expect(formatOriginTitle("ollama")).toEqual({
      title: "Ollama Models",
      isAuto: true,
      brand: "ollama",
    });
    expect(formatOriginTitle("lmstudio")).toEqual({
      title: "LM Studio",
      isAuto: true,
      brand: "lmstudio",
    });
    expect(formatOriginTitle("tools")).toEqual({
      title: "System Tools & PATH",
      isAuto: true,
    });
  });

  it("formats manual files with clean titles", () => {
    expect(formatOriginTitle("inventory/manual/tools.md")).toEqual({
      title: "Manual: Tools",
      isAuto: false,
    });
    expect(formatOriginTitle("inventory/manual/models.md")).toEqual({
      title: "Manual: Models",
      isAuto: false,
    });
    expect(formatOriginTitle("inventory/manual/practices.md")).toEqual({
      title: "Manual: Practices",
      isAuto: false,
    });
  });
});

describe("groupByOrigin", () => {
  it("groups entries and places auto scanners ahead of manual files", () => {
    const entries: InventoryEntry[] = [
      { name: "git", kind: "tool", origin: "tools" },
      { name: "deepseek-r1:8b", kind: "model", origin: "ollama" },
      { name: "custom-script", kind: "tool", origin: "inventory/manual/tools.md" },
      { name: "qwen2.5-coder:7b", kind: "model", origin: "ollama" },
    ];

    const groups = groupByOrigin(entries);

    expect(groups.length).toBe(3);
    // Ollama and Tools are auto, so they come first
    expect(groups[0]?.isAuto).toBe(true);
    expect(groups[1]?.isAuto).toBe(true);
    // Manual comes last
    expect(groups[2]?.isAuto).toBe(false);
    expect(groups[2]?.title).toBe("Manual: Tools");
    expect(groups[2]?.items.length).toBe(1);

    const ollamaGroup = groups.find((g) => g.id === "ollama");
    expect(ollamaGroup?.items.length).toBe(2);
    expect(ollamaGroup?.brand).toBe("ollama");
  });

  it("handles hundreds of entries efficiently", () => {
    const entries: InventoryEntry[] = [];
    for (let i = 0; i < 500; i++) {
      const origin =
        i % 4 === 0
          ? "ollama"
          : i % 4 === 1
            ? "claude"
            : i % 4 === 2
              ? "inventory/manual/tools.md"
              : "inventory/manual/models.md";
      entries.push({
        name: `tool-${i}`,
        kind: "tool",
        origin,
      });
    }

    const start = performance.now();
    const groups = groupByOrigin(entries);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100); // Should execute in under 100ms
    expect(groups.length).toBe(4);
    const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);
    expect(totalCount).toBe(500);
  });
});
