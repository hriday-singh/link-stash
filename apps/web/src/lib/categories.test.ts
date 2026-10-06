import { describe, expect, it } from "vitest";
import {
  categoryColorVar,
  categoryNameError,
  getCategoryToken,
  isCategoryToken,
  SEED_CATEGORIES,
} from "./categories";

describe("categories helper", () => {
  it("resolves seed categories to their corresponding tokens", () => {
    for (const cat of SEED_CATEGORIES) {
      expect(getCategoryToken(cat)).toBe(`cat-${cat}`);
      expect(getCategoryToken(`cat-${cat}`)).toBe(`cat-${cat}`);
      expect(categoryColorVar(cat)).toBe(`var(--cat-${cat})`);
      expect(categoryColorVar(`cat-${cat}`)).toBe(`var(--cat-${cat})`);
    }
  });

  it("resolves explicit extra tokens correctly", () => {
    expect(getCategoryToken("cat-extra-1")).toBe("cat-extra-1");
    expect(getCategoryToken("cat-extra-7")).toBe("cat-extra-7");
    expect(getCategoryToken("extra-3")).toBe("cat-extra-3");
    expect(categoryColorVar("cat-extra-5")).toBe("var(--cat-extra-5)");
  });

  it("deterministically maps new/custom categories to vibrant extra tokens (1 to 7)", () => {
    const token1 = getCategoryToken("workflows");
    const token2 = getCategoryToken("cat-workflows");
    expect(token1).toMatch(/^cat-extra-[1-7]$/);
    expect(token1).toBe(token2);

    const tokenPrompts = getCategoryToken("prompts");
    expect(tokenPrompts).toMatch(/^cat-extra-[1-7]$/);

    // Color var always produces valid CSS variable
    expect(categoryColorVar("workflows")).toBe(`var(--${token1})`);
    expect(categoryColorVar("cat-workflows")).toBe(`var(--${token1})`);
  });

  it("identifies valid category tokens correctly", () => {
    expect(isCategoryToken("cat-models")).toBe(true);
    expect(isCategoryToken("cat-extra-4")).toBe(true);
    expect(isCategoryToken("cat-workflows")).toBe(false);
    expect(isCategoryToken("workflows")).toBe(false);
    expect(isCategoryToken("invalid-token")).toBe(false);
  });

  it("validates category names", () => {
    expect(categoryNameError("", [])).toBe("Name is required.");
    expect(categoryNameError("Invalid Name", [])).toBe(
      "Use lowercase letters, numbers and dashes.",
    );
    expect(categoryNameError("models", ["models"])).toBe("That category already exists.");
    expect(categoryNameError("valid-cat", ["models"])).toBeNull();
  });
});
