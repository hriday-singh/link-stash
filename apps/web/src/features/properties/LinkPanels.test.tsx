import { render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { LinkPanels, type LinkPanelsProps } from "./LinkPanels";

async function renderLinkPanels(props: LinkPanelsProps) {
  const rootRoute = createRootRoute({
    component: () => <LinkPanels {...props} />,
  });

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  await router.load();
  return render(<RouterProvider router={router} />);
}

describe("LinkPanels", () => {
  it("renders loading skeleton when isLoading is true", async () => {
    await renderLinkPanels({ isLoading: true });
    expect(screen.getByTestId("link-panels-loading")).toBeInTheDocument();
  });

  it("renders empty states when there are no links", async () => {
    await renderLinkPanels({
      links: {
        backlinks: [],
        mentioned_by: [],
        outgoing: [],
      },
    });

    expect(screen.getByText("No backlinks point here.")).toBeInTheDocument();
    expect(screen.getByText("No source mentions.")).toBeInTheDocument();
    expect(screen.getByText("No outgoing links.")).toBeInTheDocument();
  });

  it("renders backlinks with link to card", async () => {
    await renderLinkPanels({
      links: {
        backlinks: [
          {
            slug: "agent-framework",
            title: "Agent Framework",
            category: "repos-tools",
            kind: "repo",
            type: "wikilink",
          },
          {
            slug: "similar-tool",
            title: "Similar Tool",
            category: "repos-tools",
            kind: "tool",
            type: "overlap",
          },
        ],
      },
    });

    expect(screen.getByText("Agent Framework")).toBeInTheDocument();
    expect(screen.getByText("Similar Tool")).toBeInTheDocument();
    expect(screen.getByText("overlap")).toBeInTheDocument();
  });

  it("renders mentioned by sources with creator and platform", async () => {
    await renderLinkPanels({
      links: {
        mentioned_by: [
          {
            id: "ig:12345",
            platform: "instagram",
            creator: "alex_coder",
            url: "https://instagram.com/reel/12345",
          },
        ],
      },
    });

    expect(screen.getByText("@alex_coder")).toBeInTheDocument();
    expect(screen.getByText("ig:12345")).toBeInTheDocument();
  });

  it("renders outgoing links: resolved as links, unresolved and inventory as text", async () => {
    await renderLinkPanels({
      links: {
        outgoing: [
          {
            target: "resolved-card",
            slug: "resolved-card",
            title: "Resolved Library Card",
            type: "wikilink",
            category: "models",
            kind: "model",
          },
          {
            target: "unresolved-slug",
            slug: "",
            title: "",
            type: "wikilink",
            category: "",
            kind: "",
          },
          {
            target: "tool:ripgrep",
            slug: "",
            title: "",
            type: "overlap",
            category: "",
            kind: "",
          },
        ],
      },
    });

    // Resolved card has title and link
    const resolvedLink = screen.getByText("Resolved Library Card");
    expect(resolvedLink.closest("a")).not.toBeNull();

    // Unresolved wikilink is text with badge, not a link
    const unresolvedText = screen.getByText("unresolved-slug");
    expect(unresolvedText.closest("a")).toBeNull();
    expect(screen.getByText("unresolved")).toBeInTheDocument();

    // Inventory overlap is text with badge, not a link
    const inventoryText = screen.getByText("tool:ripgrep");
    expect(inventoryText.closest("a")).toBeNull();
    expect(screen.getByText("inventory")).toBeInTheDocument();
  });
});
