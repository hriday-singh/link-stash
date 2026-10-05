import { render } from "@testing-library/react";
import { StashLogo } from "./StashLogo";

describe("StashLogo", () => {
  it("renders the SVG brand mark", () => {
    const { container } = render(<StashLogo size={24} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
  });
});
