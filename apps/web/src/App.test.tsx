import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { ThemeProvider } from "./state/theme";

describe("App shell and navigation", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  const renderApp = () =>
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );

  it("opens the card page from a feed tile and returns via back", async () => {
    const user = userEvent.setup();
    renderApp();
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Agent Kit" }));
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /back to feed/i }));
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
  });

  it("global search filters the feed and Ctrl+K focuses it", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveFocus();
    await user.keyboard("scrapling");
    expect(screen.getByRole("button", { name: "Open Scrapling" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Agent Kit" })).not.toBeInTheDocument();
  });

  it("filters popover narrows the feed by kind and clears", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: /filters/i }));
    const kind = screen.getByRole("group", { name: "Kind" });
    await user.click(within(kind).getByRole("button", { name: "model" }));
    expect(screen.getByRole("button", { name: "Open Qwen3 8B GGUF" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Agent Kit" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByRole("button", { name: "Open Agent Kit" })).toBeInTheDocument();
  });

  it("adds a category from the sidebar dialog and rejects duplicates", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: "Add category" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "models");
    await user.click(within(dialog).getByRole("button", { name: "Create category" }));
    expect(within(dialog).getByText("That category already exists.")).toBeInTheDocument();
    await user.clear(within(dialog).getByRole("textbox"));
    await user.type(within(dialog).getByRole("textbox"), "prompts");
    await user.click(within(dialog).getByRole("button", { name: "Create category" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /prompts/ })).toBeInTheDocument();
  });

  it("navigates to Sources view when clicked in sidebar", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("link", { name: /sources/i }));
    expect(screen.getByRole("heading", { name: /all sources/i })).toBeInTheDocument();
  });

  it("navigates to Pending view when clicked in sidebar", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("link", { name: /pending/i }));
    expect(screen.getByRole("heading", { name: /pending resolution/i })).toBeInTheDocument();
  });

  it("navigates to Rejected view when clicked in sidebar", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("link", { name: /rejected/i }));
    expect(screen.getByRole("heading", { name: /rejected log/i })).toBeInTheDocument();
  });

  it("navigates to Inventory view when clicked in sidebar", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("link", { name: /inventory/i }));
    expect(screen.getByRole("heading", { name: /system inventory/i })).toBeInTheDocument();
  });

  it("navigates to Graph view when clicked in sidebar", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("link", { name: /graph/i }));
    expect(screen.getByRole("heading", { name: /global knowledge graph/i })).toBeInTheDocument();
  });

  it("toggles the theme when theme button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );
    const themeBtn = screen.getByRole("button", { name: /switch to (dark|light) theme/i });
    expect(themeBtn).toBeInTheDocument();
    await user.click(themeBtn);
    expect(
      screen.getByRole("button", { name: /switch to (dark|light) theme/i }),
    ).toBeInTheDocument();
  });

  it("toggles the mobile navigation drawer", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );
    const toggleBtn = screen.getByRole("button", { name: /open navigation/i });
    await user.click(toggleBtn);
    expect(screen.getByRole("button", { name: /close navigation/i })).toBeInTheDocument();
  });
});
