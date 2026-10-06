import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VirtualGrid } from "./VirtualGrid";
import type { TileData } from "./Tile";

describe("VirtualGrid component", () => {
  it("renders default empty message when item list is empty", () => {
    render(<VirtualGrid items={[]} />);
    expect(screen.getByText("Paste links into /stash in Claude Code or agy.")).toBeInTheDocument();
  });

  it("renders custom empty message and subtext when provided", () => {
    render(
      <VirtualGrid
        items={[]}
        emptyMessage="No search results found"
        emptySubtext="Try adjusting your filters"
      />,
    );
    expect(screen.getByText("No search results found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your filters")).toBeInTheDocument();
  });

  it("renders day group header and items when items are passed", () => {
    const items: (TileData & { added: string })[] = [
      {
        slug: "card-1",
        key: "key-1",
        title: "Test Card 1",
        category: "models",
        categoryColor: "cat-models",
        kind: "model",
        thumbUrl: null,
        platform: "github",
        added: new Date().toISOString(),
      },
    ];

    render(
      <VirtualGrid
        items={items}
        renderItem={(item) => (
          <div data-testid="tile-item" key={item.slug}>
            {item.title}
          </div>
        )}
      />,
    );

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Test Card 1")).toBeInTheDocument();
  });
});
