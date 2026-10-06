import { render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { CardBody } from "./CardBody";

async function renderCardBody(body: string, resolved: Record<string, string> = {}) {
  const rootRoute = createRootRoute({
    component: () => <CardBody body={body} resolved={resolved} />,
  });

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  await router.load();
  return render(<RouterProvider router={router} />);
}

describe("CardBody", () => {
  it("renders resolved wikilink as TanStack router link", async () => {
    const body = "See [[tanstack-router]] for routing details.";
    const resolved = { "tanstack-router": "TanStack Router Library" };

    await renderCardBody(body, resolved);

    const link = screen.getByRole("link", { name: "TanStack Router Library" });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/c/tanstack-router");
  });

  it("renders unresolved wikilink as styled muted span", async () => {
    const body = "Check out [[future-feature]].";

    await renderCardBody(body, {});

    const unresolved = screen.getByTestId("unresolved-wikilink");
    expect(unresolved).toBeInTheDocument();
    expect(unresolved).toHaveTextContent("[[future-feature]]");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("sanitizes unsafe javascript: links to plain text", async () => {
    const body = "Dangerous [click here](javascript:alert('pwned'))";

    await renderCardBody(body);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("click here")).toBeInTheDocument();
  });

  it("escapes raw script tags rather than injecting HTML", async () => {
    const body = "Here is some code: <script>window.__injected = true;</script>";

    const { container } = await renderCardBody(body);

    expect(container.querySelector("script")).toBeNull();
    expect((window as unknown as { __injected?: boolean }).__injected).toBeUndefined();
  });

  it("renders valid external links with proper attributes", async () => {
    const body = "Visit [Official Docs](https://example.com/docs)";

    await renderCardBody(body);

    const link = screen.getByRole("link", { name: "Official Docs" });
    expect(link).toHaveAttribute("href", "https://example.com/docs");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
