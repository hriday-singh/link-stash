import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "./ThemeToggle";
import { ThemeProvider } from "@/state/theme";

describe("ThemeToggle Component", () => {
  it("renders with accessible label and toggles theme on click", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label");

    const initialLabel = button.getAttribute("aria-label");
    await user.click(button);

    // The aria-label toggles between light and dark
    const nextLabel = button.getAttribute("aria-label");
    expect(nextLabel).not.toBe(initialLabel);
  });

  it("is reachable and activatable via keyboard", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole("button");
    button.focus();
    expect(button).toHaveFocus();

    const labelBefore = button.getAttribute("aria-label");
    await user.keyboard("{Enter}");
    const labelAfter = button.getAttribute("aria-label");
    expect(labelAfter).not.toBe(labelBefore);
  });

  it("renders collapsed variant without text label", () => {
    render(
      <ThemeProvider>
        <ThemeToggle collapsed />
      </ThemeProvider>
    );

    const button = screen.getByRole("button");
    expect(button).toHaveClass("justify-center");
    expect(screen.queryByText("Dark mode")).not.toBeInTheDocument();
    expect(screen.queryByText("Light mode")).not.toBeInTheDocument();
  });
});
