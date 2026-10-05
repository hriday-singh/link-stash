import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "./SegmentedControl";

describe("SegmentedControl", () => {
  const options = [
    { value: "feed", label: "Feed" },
    { value: "card", label: "Card page" },
  ] as const;

  it("renders all options and indicates the selected segment", () => {
    render(<SegmentedControl value="feed" onChange={() => {}} options={options} />);
    const feedBtn = screen.getByRole("button", { name: "Feed" });
    const cardBtn = screen.getByRole("button", { name: "Card page" });

    expect(feedBtn).toHaveAttribute("aria-pressed", "true");
    expect(cardBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("fires onChange when an unselected option is clicked", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<SegmentedControl value="feed" onChange={handleChange} options={options} />);

    await user.click(screen.getByRole("button", { name: "Card page" }));
    expect(handleChange).toHaveBeenCalledWith("card");
  });
});
