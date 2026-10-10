import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { RejectedPage } from "./RejectedPage";
import { keyToUrl } from "@/lib/keyUrl";
import { api } from "@/api/client";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("keyToUrl", () => {
  it("maps each key shape back to a link", () => {
    expect(keyToUrl("github:a/b")).toBe("https://github.com/a/b");
    expect(keyToUrl("hf:model:org/m")).toBe("https://huggingface.co/org/m");
    expect(keyToUrl("hf:dataset:org/d")).toBe("https://huggingface.co/datasets/org/d");
    expect(keyToUrl("hf:space:org/s")).toBe("https://huggingface.co/spaces/org/s");
    expect(keyToUrl("ig:ABC123")).toBe("https://www.instagram.com/p/ABC123/");
    expect(keyToUrl("url:example.com/x")).toBe("https://example.com/x");
    expect(keyToUrl("url:https://example.com/x")).toBe("https://example.com/x");
    expect(keyToUrl("weird")).toBeNull();
    expect(keyToUrl("hf:other:org/x")).toBeNull();
  });
});

describe("RejectedPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("renders rejected items list", async () => {
    vi.spyOn(api, "GET").mockImplementation(async (path: string) => {
      if (path === "/api/rejects") {
        return {
          data: [
            {
              key: "github:langchain-ai/legacy-wrapper",
              reason: "Superceded by native LLM tool calling",
              date: "2026-10-02",
            },
            {
              key: "url:https://shady-site.com/dl",
              reason: "Security risk",
              date: "2026-09-24",
            },
          ],
          response: new Response(null, { status: 200 }),
        } as unknown as ReturnType<typeof api.GET>;
      }
      return {
        data: null,
        response: new Response(null, { status: 404 }),
      } as unknown as ReturnType<typeof api.GET>;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RejectedPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("github:langchain-ai/legacy-wrapper")).toBeInTheDocument();
    expect(screen.getByText("Superceded by native LLM tool calling")).toBeInTheDocument();
    expect(screen.getByText("url:https://shady-site.com/dl")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Un-reject" }).length).toBe(2);
  });

  it("calls DELETE when un-reject is clicked and shows success toast", async () => {
    const user = userEvent.setup();

    vi.spyOn(api, "GET").mockImplementation(async () => {
      return {
        data: [
          {
            key: "github:langchain-ai/legacy-wrapper",
            reason: "Superceded by native LLM tool calling",
            date: "2026-10-02",
          },
        ],
        response: new Response(null, { status: 200 }),
      } as unknown as ReturnType<typeof api.GET>;
    });

    const deleteSpy = vi.spyOn(api, "DELETE").mockImplementation(async () => {
      return {
        data: { ok: true },
        response: new Response(null, { status: 200 }),
      } as unknown as ReturnType<typeof api.DELETE>;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RejectedPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("github:langchain-ai/legacy-wrapper")).toBeInTheDocument();

    const unrejectBtn = screen.getByRole("button", { name: "Un-reject" });
    await user.click(unrejectBtn);

    expect(deleteSpy).toHaveBeenCalledWith("/api/rejects/{key}", {
      params: { path: { key: "github:langchain-ai/legacy-wrapper" } },
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Removed from rejected log. Re-run it to save the card again.",
      expect.objectContaining({
        description: "/stash https://github.com/langchain-ai/legacy-wrapper",
      }),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("handles 404 on un-reject as a quiet refresh without error toast", async () => {
    const user = userEvent.setup();

    vi.spyOn(api, "GET").mockImplementation(async () => {
      return {
        data: [
          {
            key: "github:already-removed",
            reason: "Already un-rejected via CLI",
            date: "2026-10-02",
          },
        ],
        response: new Response(null, { status: 200 }),
      } as unknown as ReturnType<typeof api.GET>;
    });

    // Simulate 404 ApiError from unwrap
    vi.spyOn(api, "DELETE").mockImplementation(async () => {
      return {
        data: undefined,
        error: { code: "NOT_FOUND", message: "Reject entry not found" },
        response: new Response(null, { status: 404, statusText: "Not Found" }),
      } as unknown as ReturnType<typeof api.DELETE>;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RejectedPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("github:already-removed")).toBeInTheDocument();

    const unrejectBtn = screen.getByRole("button", { name: "Un-reject" });
    await user.click(unrejectBtn);

    // Assert that NO error toast was triggered
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("renders one-line empty state when no rejected items exist", async () => {
    vi.spyOn(api, "GET").mockImplementation(async () => {
      return {
        data: [],
        response: new Response(null, { status: 200 }),
      } as unknown as ReturnType<typeof api.GET>;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RejectedPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("No rejected items.")).toBeInTheDocument();
  });
});
