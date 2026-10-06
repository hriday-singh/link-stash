import { describe, expect, it } from "vitest";
import {
  resolveCssVarToHex,
  resolveCategoryColor,
  resolveEdgeColor,
} from "./colorResolver";

describe("colorResolver", () => {
  it("resolves CSS var fallback in test environment when not defined", () => {
    const color = resolveCssVarToHex("--non-existent-var", "#123456");
    expect(color).toBe("#123456");
  });

  it("resolves category colors to hex format", () => {
    const modelColor = resolveCategoryColor("models");
    expect(modelColor).toMatch(/^#[0-9a-f]{6}$/i);

    const sourceColor = resolveCategoryColor("source");
    expect(sourceColor).toMatch(/^#[0-9a-f]{6}$/i);

    const creatorColor = resolveCategoryColor("creator");
    expect(creatorColor).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("handles cat- prefix gracefully", () => {
    const withPrefix = resolveCategoryColor("cat-models");
    const withoutPrefix = resolveCategoryColor("models");
    expect(withPrefix).toBe(withoutPrefix);
  });

  it("resolves edge colors for wikilink, source, and overlap", () => {
    expect(resolveEdgeColor("wikilink")).toMatch(/^#[0-9a-f]{6}$/i);
    expect(resolveEdgeColor("source")).toMatch(/^#[0-9a-f]{6}$/i);
    expect(resolveEdgeColor("overlap")).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
