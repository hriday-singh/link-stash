import type { CompletionContext } from "@codemirror/autocomplete";
import { describe, expect, it, vi } from "vitest";
import { createWikilinkCompletion } from "./wikilinkCompletion";

describe("createWikilinkCompletion", () => {
  it("returns null when [[ is not preceding the cursor", async () => {
    const fetchCards = vi.fn();
    const source = createWikilinkCompletion(fetchCards);

    const context = {
      matchBefore: vi.fn().mockReturnValue(null),
      pos: 10,
    } as unknown as CompletionContext;

    const result = await source(context);
    expect(result).toBeNull();
    expect(fetchCards).not.toHaveBeenCalled();
  });

  it("extracts query after [[ and returns formatted completions", async () => {
    const fetchCards = vi.fn().mockResolvedValue([
      { slug: "fastapi", title: "FastAPI Framework" },
      { slug: "pydantic", title: "Pydantic Models" },
    ]);
    const source = createWikilinkCompletion(fetchCards);

    const context = {
      matchBefore: vi.fn().mockImplementation((pattern: RegExp) => {
        // Test with text "[[fast"
        const text = "[[fast";
        if (pattern.test(text)) {
          return { from: 5, to: 11, text };
        }
        return null;
      }),
      pos: 11,
    } as unknown as CompletionContext;

    const result = await source(context);
    expect(fetchCards).toHaveBeenCalledWith("fast");
    expect(result).not.toBeNull();
    expect(result?.from).toBe(7); // from (5) + 2
    expect(result?.options).toHaveLength(2);
    expect(result?.options[0]).toEqual({
      label: "FastAPI Framework",
      displayLabel: "FastAPI Framework",
      detail: "fastapi",
      apply: "fastapi]]",
    });
  });

  it("returns null if fetchCards yields no results", async () => {
    const fetchCards = vi.fn().mockResolvedValue([]);
    const source = createWikilinkCompletion(fetchCards);

    const context = {
      matchBefore: vi.fn().mockReturnValue({ from: 0, to: 2, text: "[[" }),
      pos: 2,
    } as unknown as CompletionContext;

    const result = await source(context);
    expect(result).toBeNull();
  });
});
