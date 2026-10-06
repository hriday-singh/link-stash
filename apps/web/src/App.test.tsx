import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryHistory } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { createStashRouter } from "./router";
import { ThemeProvider } from "./state/theme";

describe("App shell, Router, and navigation", () => {
  const renderApp = (initialEntries: string[] = ["/"]) => {
    const history = createMemoryHistory({ initialEntries });
    const router = createStashRouter(history);

    const result = render(
      <ThemeProvider>
        <App router={router} />
      </ThemeProvider>,
    );

    return { ...result, router, history };
  };

  it("renders the feed page with empty state message on initial load", async () => {
    renderApp(["/"]);
    expect(
      await screen.findByRole("heading", { name: "Feed" }, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Paste links into /stash in Claude Code or agy."),
    ).toBeInTheDocument();
  });

  it("drops unknown/invalid URL params silently and still loads the page", async () => {
    renderApp(["/?kind=banana&since=not-a-date&unknown_param=true"]);
    expect(await screen.findByRole("heading", { name: "Feed" })).toBeInTheDocument();
    expect(
      screen.getByText("Paste links into /stash in Claude Code or agy."),
    ).toBeInTheDocument();
  });

  it("opens Command Palette on Ctrl+K and closes on escape", async () => {
    const user = userEvent.setup();
    renderApp(["/"]);

    expect(await screen.findByRole("heading", { name: "Feed" })).toBeInTheDocument();
    await user.keyboard("{Control>}k{/Control}");

    expect(
      await screen.findByPlaceholderText("Type a command or search cards…"),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText("Type a command or search cards…"),
      ).not.toBeInTheDocument();
    });
  });

  it("navigates to Sources view when clicked in sidebar", async () => {
    const user = userEvent.setup();
    renderApp(["/"]);

    const sourcesLink = await screen.findByRole("link", { name: /sources/i });
    await user.click(sourcesLink);

    expect(await screen.findByRole("heading", { name: /^sources/i })).toBeInTheDocument();
  });

  it("navigates to Pending view when clicked in sidebar", async () => {
    const user = userEvent.setup();
    renderApp(["/"]);

    const pendingLink = await screen.findByRole("link", { name: /pending/i });
    await user.click(pendingLink);

    expect(
      await screen.findByRole("heading", { name: /pending resolution/i }),
    ).toBeInTheDocument();
  });

  it("navigates to Rejected view when clicked in sidebar", async () => {
    const user = userEvent.setup();
    renderApp(["/"]);

    const rejectedLink = await screen.findByRole("link", { name: /rejected/i });
    await user.click(rejectedLink);

    expect(
      await screen.findByRole("heading", { name: /rejected log/i }),
    ).toBeInTheDocument();
  });

  it("navigates to Inventory view when clicked in sidebar", async () => {
    const user = userEvent.setup();
    renderApp(["/"]);

    const inventoryLink = await screen.findByRole("link", { name: /inventory/i });
    await user.click(inventoryLink);

    expect(
      await screen.findByRole("heading", { name: /system inventory/i }),
    ).toBeInTheDocument();
  });

  it("navigates to category route with category indicator", async () => {
    const user = userEvent.setup();
    renderApp(["/"]);

    const modelsLink = await screen.findByRole("link", { name: /models/i });
    await user.click(modelsLink);

    expect(await screen.findByRole("heading", { name: /models/i })).toBeInTheDocument();
  });

  it("adds a category from the sidebar dialog and rejects duplicates", async () => {
    const user = userEvent.setup();
    renderApp(["/"]);

    const addBtn = await screen.findByRole("button", { name: "Add category" });
    await user.click(addBtn);

    const dialog = screen.getByRole("dialog");
    const input = within(dialog).getByRole("textbox");

    await user.type(input, "models");
    await user.click(within(dialog).getByRole("button", { name: "Create category" }));
    expect(within(dialog).getByText("That category already exists.")).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "prompts");
    await user.click(within(dialog).getByRole("button", { name: "Create category" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /prompts/ })).toBeInTheDocument();
  });
});
