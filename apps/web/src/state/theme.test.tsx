import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "./theme";

function mockSystemDark(dark: boolean) {
  window.matchMedia = (query: string) =>
    ({
      matches: dark && query.includes("dark"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList;
}

function Probe() {
  const { resolved, toggle } = useTheme();
  return <button onClick={toggle}>{resolved}</button>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});
afterEach(() => vi.restoreAllMocks());

it("follows the system by default", () => {
  mockSystemDark(true);
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  expect(screen.getByRole("button")).toHaveTextContent("dark");
  expect(document.documentElement).toHaveClass("dark");
});

it("toggle flips the theme and remembers it", async () => {
  mockSystemDark(false);
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  await userEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("button")).toHaveTextContent("dark");
  expect(localStorage.getItem("stash.theme")).toBe("dark");
});

it("still works when localStorage throws", async () => {
  mockSystemDark(true);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  expect(screen.getByRole("button")).toHaveTextContent("dark");
  await act(() => userEvent.click(screen.getByRole("button")));
  expect(screen.getByRole("button")).toHaveTextContent("light");
});
