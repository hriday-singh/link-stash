import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandLogo, brandFor } from "./BrandLogo";

describe("brandFor resolution", () => {
  it("resolves exact and aliased platforms and tools", () => {
    expect(brandFor("instagram")?.id).toBe("instagram");
    expect(brandFor("ig")?.id).toBe("instagram");
    expect(brandFor("ig:DE-3r3_s")?.id).toBe("instagram");
    expect(brandFor("Instagram Reel")?.id).toBe("instagram");

    expect(brandFor("github")?.id).toBe("github");
    expect(brandFor("gh")?.id).toBe("github");
    expect(brandFor("github:owner/repo")?.id).toBe("github");

    expect(brandFor("huggingface")?.id).toBe("huggingface");
    expect(brandFor("hf")?.id).toBe("huggingface");
    expect(brandFor("Hugging Face")?.id).toBe("huggingface");

    expect(brandFor("notion")?.id).toBe("notion");
    expect(brandFor("ollama")?.id).toBe("ollama");
    expect(brandFor("lmstudio")?.id).toBe("lmstudio");
    expect(brandFor("lm studio")?.id).toBe("lmstudio");
    expect(brandFor("claude")?.id).toBe("claude");
    expect(brandFor("anthropic")?.id).toBe("claude");
    expect(brandFor("gemini")?.id).toBe("gemini");
    expect(brandFor("google")?.id).toBe("gemini");
    expect(brandFor("antigravity")?.id).toBe("antigravity");
    expect(brandFor("agy")?.id).toBe("antigravity");
    expect(brandFor("codex")?.id).toBe("codex");
    expect(brandFor("qwen")?.id).toBe("qwen");
  });

  it("returns null for unknown strings or falsy inputs", () => {
    expect(brandFor("")).toBeNull();
    expect(brandFor(null)).toBeNull();
    expect(brandFor(undefined)).toBeNull();
    expect(brandFor("unknown-tool-xyz")).toBeNull();
  });
});

describe("BrandLogo Component", () => {
  it("renders SVG with accessible label for recognized brand", () => {
    render(<BrandLogo brand="github" size={24} className="test-icon" />);
    const svg = screen.getByRole("img", { name: "GitHub" });
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
    expect(svg).toHaveClass("test-icon");
  });

  it("renders Instagram logo correctly", () => {
    render(<BrandLogo brand="Instagram Reel" size={18} />);
    const svg = screen.getByRole("img", { name: "Instagram" });
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "18");
  });

  it("renders null for unknown brand without throwing", () => {
    const { container } = render(<BrandLogo brand="nonexistent-brand" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null for undefined or null brand", () => {
    const { container } = render(<BrandLogo brand={null} />);
    expect(container.firstChild).toBeNull();
  });
});
