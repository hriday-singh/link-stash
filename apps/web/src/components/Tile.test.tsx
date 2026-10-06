import { render, screen } from "@testing-library/react";
import { Tile, type TileData } from "./Tile";

const base: TileData = {
  slug: "agent-kit",
  key: "github:owner/agent-kit",
  title: "Agent Kit",
  category: "repos-tools",
  categoryColor: "cat-repos-tools",
  kind: "repo",
  thumbUrl: null,
  platform: null,
};

it("shows a generated tile when there is no thumbnail", () => {
  render(<Tile data={base} />);
  expect(screen.getByTestId("generated-tile")).toHaveTextContent("repo");
  expect(screen.getByTestId("generated-tile")).toHaveTextContent("owner");
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

it("shows the thumbnail when there is one", () => {
  render(<Tile data={{ ...base, thumbUrl: "/api/sources/ig%3AAAA/thumb" }} />);
  expect(screen.queryByTestId("generated-tile")).not.toBeInTheDocument();
  expect(document.querySelector("img")).toHaveAttribute("src", "/api/sources/ig%3AAAA/thumb");
});

it("shows title and category pill", () => {
  render(<Tile data={base} />);
  expect(screen.getByRole("heading", { name: "Agent Kit" })).toBeInTheDocument();
  expect(screen.getByText("repos-tools")).toBeInTheDocument();
});

it("assigns viewTransitionName matching card slug for shared view transitions", () => {
  const { container } = render(<Tile data={base} />);
  const mediaContainer = container.querySelector(".relative.aspect-\\[4\\/3\\]") as HTMLElement;
  expect(mediaContainer).toBeInTheDocument();
  expect(mediaContainer.style.viewTransitionName).toBe("card-agent-kit");
});

it("shows the bucket label only when set", () => {
  const { rerender } = render(<Tile data={base} />);
  expect(screen.queryByText("Try now")).not.toBeInTheDocument();
  rerender(<Tile data={{ ...base, bucket: "try-now" }} />);
  expect(screen.getByText("Try now")).toBeInTheDocument();
});
