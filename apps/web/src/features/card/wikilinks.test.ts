import { describe, expect, it } from "vitest";
import { isSafeUrl, preprocessWikilinks } from "./wikilinks";

describe("preprocessWikilinks", () => {
  it("converts resolved wikilinks to /c/slug path with title", () => {
    const text = "Check out [[fastapi]] for web APIs.";
    const resolved = { fastapi: "FastAPI Web Framework" };
    const result = preprocessWikilinks(text, resolved);
    expect(result).toBe("Check out [FastAPI Web Framework](/c/fastapi) for web APIs.");
  });

  it("converts resolved wikilinks with alias correctly", () => {
    const text = "Check out [[fastapi|Python API]] here.";
    const resolved = { fastapi: "FastAPI Web Framework" };
    const result = preprocessWikilinks(text, resolved);
    expect(result).toBe("Check out [Python API](/c/fastapi) here.");
  });

  it("converts unresolved wikilinks to unresolved hash scheme", () => {
    const text = "See [[missing-doc]] for details.";
    const result = preprocessWikilinks(text, {});
    expect(result).toBe("See [missing-doc](#stash-unresolved:missing-doc) for details.");
  });

  it("preserves code blocks and inline code containing wikilink brackets", () => {
    const text = "Use `[[not-a-link]]` or:\n```\n[[also-not-a-link]]\n```\nbut this [[real-link]] works.";
    const resolved = { "real-link": "Real Title" };
    const result = preprocessWikilinks(text, resolved);
    expect(result).toContain("`[[not-a-link]]`");
    expect(result).toContain("```\n[[also-not-a-link]]\n```");
    expect(result).toContain("[Real Title](/c/real-link)");
  });

  it("handles empty or falsy text", () => {
    expect(preprocessWikilinks("")).toBe("");
  });
});

describe("isSafeUrl", () => {
  it("accepts safe URLs", () => {
    expect(isSafeUrl("https://github.com/fastapi")).toBe(true);
    expect(isSafeUrl("http://localhost:8000")).toBe(true);
    expect(isSafeUrl("/c/slug")).toBe(true);
    expect(isSafeUrl("#heading")).toBe(true);
    expect(isSafeUrl("mailto:test@example.com")).toBe(true);
  });

  it("rejects malicious or unsafe protocols", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("JAVASCRIPT:void(0)")).toBe(false);
    expect(isSafeUrl(" javascript:evil()")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeUrl("vbscript:msgbox(1)")).toBe(false);
  });

  it("rejects empty or undefined", () => {
    expect(isSafeUrl("")).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
  });
});
