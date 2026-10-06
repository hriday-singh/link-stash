import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResolveForm, isValidHttpUrl } from "./ResolveForm";

describe("isValidHttpUrl", () => {
  it("validates http and https URLs", () => {
    expect(isValidHttpUrl("https://example.com/guide")).toBe(true);
    expect(isValidHttpUrl("http://localhost:8000/test")).toBe(true);
  });

  it("rejects non-http protocols and malformed strings", () => {
    expect(isValidHttpUrl("not-a-url")).toBe(false);
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("")).toBe(false);
  });
});

describe("ResolveForm Component", () => {
  it("shows error and does not call onResolve when URL is invalid", async () => {
    const user = userEvent.setup();
    const handleResolve = vi.fn().mockResolvedValue(undefined);

    render(
      <ResolveForm itemId="p-1" isResolving={false} onResolve={handleResolve} />
    );

    const input = screen.getByRole("textbox");
    const submitBtn = screen.getByRole("button", { name: "Resolve & Save" });

    await user.type(input, "not-a-valid-url");
    await user.click(submitBtn);

    expect(screen.getByTestId("resolve-error")).toHaveTextContent(
      "Please enter a valid http(s) URL."
    );
    expect(handleResolve).not.toHaveBeenCalled();
  });

  it("submits valid URL and calls onResolve", async () => {
    const user = userEvent.setup();
    const handleResolve = vi.fn().mockResolvedValue(undefined);

    render(
      <ResolveForm itemId="p-1" isResolving={false} onResolve={handleResolve} />
    );

    const input = screen.getByRole("textbox");
    const submitBtn = screen.getByRole("button", { name: "Resolve & Save" });

    await user.type(input, "https://github.com/owner/repo");
    await user.click(submitBtn);

    expect(screen.queryByTestId("resolve-error")).not.toBeInTheDocument();
    expect(handleResolve).toHaveBeenCalledWith("https://github.com/owner/repo");
  });
});
