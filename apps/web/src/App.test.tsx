import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { ThemeProvider } from "./state/theme";

it("switches between the feed and card mocks", async () => {
  render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
  expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Card page" }));
  expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
});
