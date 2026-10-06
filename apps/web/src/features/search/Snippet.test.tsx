import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Snippet } from "./Snippet";

describe("Snippet highlighter", () => {
  it("renders plain text without mark elements", () => {
    render(<Snippet text="A simple plain sentence." />);
    expect(screen.getByText("A simple plain sentence.")).toBeInTheDocument();
    expect(document.querySelector("mark")).toBeNull();
  });

  it("converts FTS5 ASCII markers to mark elements", () => {
    const raw = "Here is a \x02highlighted\x03 term in context.";
    render(<Snippet text={raw} />);

    const mark = document.querySelector("mark");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("highlighted");
  });

  it("handles multiple highlights and escapes malicious script tags safely", () => {
    const raw = "\x02<script>alert(1)</script>\x03 and another \x02match\x03";
    render(<Snippet text={raw} />);

    expect(document.querySelectorAll("mark")).toHaveLength(2);
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
  });

  it("handles unclosed highlight markers gracefully", () => {
    const raw = "Leading text with \x02unclosed highlight";
    render(<Snippet text={raw} />);

    const mark = document.querySelector("mark");
    expect(mark?.textContent).toBe("unclosed highlight");
  });
});
