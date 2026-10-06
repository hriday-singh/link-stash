import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RejectDialog } from "./RejectDialog";

describe("RejectDialog", () => {
  it("renders when open and displays card title", () => {
    render(
      <RejectDialog
        open={true}
        onOpenChange={vi.fn()}
        cardTitle="Super Duper Agent"
        onConfirmReject={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Reject Card" })).toBeInTheDocument();
    expect(screen.getByText(/Super Duper Agent/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Not relevant/)).toBeInTheDocument();
  });

  it("blocks submission and shows error if reason is empty", async () => {
    const user = userEvent.setup();
    const onConfirmReject = vi.fn();

    render(
      <RejectDialog
        open={true}
        onOpenChange={vi.fn()}
        cardTitle="Test Item"
        onConfirmReject={onConfirmReject}
      />
    );

    const submitBtn = screen.getByRole("button", { name: "Reject Card" });
    await user.click(submitBtn);

    expect(screen.getByText("Please provide a reason for rejecting this card.")).toBeInTheDocument();
    expect(onConfirmReject).not.toHaveBeenCalled();
  });

  it("calls onConfirmReject with trimmed reason on submit", async () => {
    const user = userEvent.setup();
    const onConfirmReject = vi.fn();

    render(
      <RejectDialog
        open={true}
        onOpenChange={vi.fn()}
        cardTitle="Test Item"
        onConfirmReject={onConfirmReject}
      />
    );

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "  Broken repository and abandoned  ");

    const submitBtn = screen.getByRole("button", { name: "Reject Card" });
    await user.click(submitBtn);

    expect(onConfirmReject).toHaveBeenCalledWith("Broken repository and abandoned");
  });

  it("calls onOpenChange(false) when clicking Cancel", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <RejectDialog
        open={true}
        onOpenChange={onOpenChange}
        cardTitle="Test Item"
        onConfirmReject={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
