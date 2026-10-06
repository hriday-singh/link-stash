import { describe, expect, it } from "vitest";
import { parseCardFilters, serializeCardFilters } from "./filters";

describe("Card search filters", () => {
  it("parses valid parameters correctly", () => {
    const raw = {
      category: "models",
      kind: "model",
      tag: "llm",
      creator: "antigravity",
      since: "2026-10-01",
      until: "2026-10-06",
      has_video: "true",
      q: "search query",
    };

    const parsed = parseCardFilters(raw);
    expect(parsed).toEqual({
      category: "models",
      kind: "model",
      tag: "llm",
      creator: "antigravity",
      since: "2026-10-01",
      until: "2026-10-06",
      has_video: true,
      q: "search query",
    });
  });

  it("drops invalid parameters silently while keeping valid ones", () => {
    const raw = {
      category: "models",
      kind: "banana", // invalid kind
      since: "bad-date-format", // invalid date
      has_video: "not-a-bool", // invalid boolean
      random_junk: 12345, // unknown param
      tag: "agent", // valid tag
    };

    const parsed = parseCardFilters(raw);
    expect(parsed).toEqual({
      category: "models",
      tag: "agent",
    });
    expect(parsed.kind).toBeUndefined();
    expect(parsed.since).toBeUndefined();
  });

  it("parses URLSearchParams instances", () => {
    const searchParams = new URLSearchParams("kind=repo&category=tools&has_video=1");
    const parsed = parseCardFilters(searchParams);
    expect(parsed).toEqual({
      kind: "repo",
      category: "tools",
      has_video: true,
    });
  });

  it("serializes filters into record of strings", () => {
    const filters = {
      category: "models",
      kind: "model" as const,
      has_video: true,
    };
    const serialized = serializeCardFilters(filters);
    expect(serialized).toEqual({
      category: "models",
      kind: "model",
      has_video: "true",
    });
  });

  it("keeps a known bucket and drops an unknown one", () => {
    expect(parseCardFilters({ bucket: "later" }).bucket).toBe("later");
    expect(parseCardFilters({ bucket: "someday" }).bucket).toBeUndefined();
    expect(serializeCardFilters({ bucket: "upgrade" })).toEqual({ bucket: "upgrade" });
  });
});
