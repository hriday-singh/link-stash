import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChipInput } from "./chip-input";

describe("ChipInput", () => {
  it("renders existing chips with remove buttons", () => {
    const onChange = vi.fn();
    render(<ChipInput value={["ai", "fastapi"]} onChange={onChange} />);

    expect(screen.getByText("ai")).toBeInTheDocument();
    expect(screen.getByText("fastapi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove tag ai" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove tag fastapi" })).toBeInTheDocument();
  });

  it("adds chip when user types and presses Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChipInput value={["existing"]} onChange={onChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "new-tag{Enter}");

    expect(onChange).toHaveBeenCalledWith(["existing", "new-tag"]);
  });

  it("adds chip when user types comma", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChipInput value={[]} onChange={onChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "agent,");

    expect(onChange).toHaveBeenCalledWith(["agent"]);
  });

  it("removes chip when clicking the remove button", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChipInput value={["tag1", "tag2"]} onChange={onChange} />);

    const removeBtn = screen.getByRole("button", { name: "Remove tag tag1" });
    await user.click(removeBtn);

    expect(onChange).toHaveBeenCalledWith(["tag2"]);
  });

  it("removes the last chip on Backspace when input is empty", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChipInput value={["tag1", "tag2"]} onChange={onChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "{Backspace}");

    expect(onChange).toHaveBeenCalledWith(["tag1"]);
  });

  it("shows autocomplete suggestions and allows selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChipInput
        value={[]}
        onChange={onChange}
        suggestions={["typescript", "python", "tailwind"]}
      />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "type");

    const option = await screen.findByRole("button", { name: "typescript" });
    expect(option).toBeInTheDocument();

    await user.click(option);
    expect(onChange).toHaveBeenCalledWith(["typescript"]);
  });
});
