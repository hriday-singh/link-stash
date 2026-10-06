import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextMorph } from "./TextMorph";

describe("TextMorph component", () => {
  it("renders text content", () => {
    render(<TextMorph>Feed</TextMorph>);
    expect(screen.getByText("Feed")).toBeInTheDocument();
  });

  it("renders numeric counter content", () => {
    render(<TextMorph>{42}</TextMorph>);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders updated text when prop changes", () => {
    const { rerender } = render(<TextMorph>Initial</TextMorph>);
    expect(screen.getByText("Initial")).toBeInTheDocument();

    rerender(<TextMorph>Updated</TextMorph>);
    expect(screen.getByText("Updated")).toBeInTheDocument();
  });

  it("applies custom class name and inline-block utility", () => {
    const { container } = render(<TextMorph className="text-primary font-mono">100</TextMorph>);
    const element = container.querySelector("span");
    expect(element).toHaveClass("inline-block");
    expect(element).toHaveClass("text-primary");
    expect(element).toHaveClass("font-mono");
  });
});
