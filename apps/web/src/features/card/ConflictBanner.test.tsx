import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConflictBanner } from "./ConflictBanner";

describe("ConflictBanner", () => {
  it("renders conflict warning with Reload and Keep Mine buttons", () => {
    render(<ConflictBanner onReload={vi.fn()} onKeepMine={vi.fn()} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Concurrent Edit Conflict (409)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload from disk" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep mine" })).toBeInTheDocument();
  });

  it("calls onReload when Reload button is clicked", async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    render(<ConflictBanner onReload={onReload} onKeepMine={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Reload from disk" }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("calls onKeepMine when Keep Mine button is clicked", async () => {
    const user = userEvent.setup();
    const onKeepMine = vi.fn();
    render(<ConflictBanner onReload={vi.fn()} onKeepMine={onKeepMine} />);

    await user.click(screen.getByRole("button", { name: "Keep mine" }));
    expect(onKeepMine).toHaveBeenCalledTimes(1);
  });

  it("disables action buttons when isSaving is true", () => {
    render(<ConflictBanner onReload={vi.fn()} onKeepMine={vi.fn()} isSaving={true} />);

    expect(screen.getByRole("button", { name: "Reload from disk" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
});
