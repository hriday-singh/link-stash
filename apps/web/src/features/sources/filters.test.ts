import { describe, it, expect } from "vitest";
import { parseSourceFilters, serializeSourceFilters } from "./filters";

describe("parseSourceFilters", () => {
  it("parses valid search parameters from an object", () => {
    const parsed = parseSourceFilters({
      platform: "instagram",
      creator: "@agentbuilder",
      stage: "triaged",
      has_video: "true",
      cursor: "cur_123",
    });

    expect(parsed).toEqual({
      platform: "instagram",
      creator: "@agentbuilder",
      stage: "triaged",
      has_video: true,
      cursor: "cur_123",
    });
  });

  it("parses parameters from URLSearchParams", () => {
    const params = new URLSearchParams("platform=github&has_video=1&creator=octocat");
    const parsed = parseSourceFilters(params);

    expect(parsed.platform).toBe("github");
    expect(parsed.has_video).toBe(true);
    expect(parsed.creator).toBe("octocat");
  });

  it("ignores unknown or empty fields", () => {
    const parsed = parseSourceFilters({
      platform: "",
      creator: "   ",
      unknown: "xyz",
    });

    expect(parsed).toEqual({});
  });

  it("handles boolean has_video properly", () => {
    expect(parseSourceFilters({ has_video: true }).has_video).toBe(true);
    expect(parseSourceFilters({ has_video: false }).has_video).toBeUndefined();
    expect(parseSourceFilters({ has_video: "false" }).has_video).toBeUndefined();
  });
});

describe("serializeSourceFilters", () => {
  it("serializes filters into record of strings", () => {
    const serialized = serializeSourceFilters({
      platform: "instagram",
      creator: "@builder",
      has_video: true,
      stage: "extracted",
    });

    expect(serialized).toEqual({
      platform: "instagram",
      creator: "@builder",
      has_video: "true",
      stage: "extracted",
    });
  });

  it("omits undefined fields", () => {
    const serialized = serializeSourceFilters({});
    expect(serialized).toEqual({});
  });
});
