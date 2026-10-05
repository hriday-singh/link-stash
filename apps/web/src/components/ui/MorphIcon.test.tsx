import { render } from "@testing-library/react";
import { Sun01Icon, Moon02Icon } from "@hugeicons/core-free-icons";
import { MorphIcon } from "./MorphIcon";

describe("MorphIcon component", () => {
  it("renders with a Hugeicon node", () => {
    const { container } = render(<MorphIcon icon={Sun01Icon} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders with an accessible label when provided", () => {
    const { container } = render(<MorphIcon icon={Moon02Icon} label="Dark Mode" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("role", "img");
    expect(container.querySelector("title")).toHaveTextContent("Dark Mode");
  });

  it("applies custom size and classNames", () => {
    const { container } = render(<MorphIcon icon={Sun01Icon} size={24} className="text-primary" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass("text-primary");
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
  });
});
