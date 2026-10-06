import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { InventoryPage } from "./InventoryPage";
import { api } from "@/api/client";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("InventoryPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("renders grouped inventory entries", async () => {
    vi.spyOn(api, "GET").mockImplementation(async (path: string) => {
      if (path === "/api/inventory") {
        return {
          data: [
            {
              name: "qwen2.5-coder:7b",
              kind: "model",
              origin: "ollama",
              key: "ollama:qwen2.5-coder:7b",
            },
            {
              name: "Claude Code",
              kind: "tool",
              origin: "claude",
              key: null,
            },
            {
              name: "vllm",
              kind: "tool",
              origin: "inventory/manual/tools.md",
              key: "manual:vllm",
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
        <InventoryPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Ollama Models (1)")).toBeInTheDocument();
    expect(screen.getByText("Claude Code (1)")).toBeInTheDocument();
    expect(screen.getByText("Manual: Tools (1)")).toBeInTheDocument();
    expect(screen.getByText("qwen2.5-coder:7b")).toBeInTheDocument();
    expect(screen.getByText("vllm")).toBeInTheDocument();
  });

  it("submits a new manual entry to POST /api/inventory", async () => {
    const user = userEvent.setup();

    vi.spyOn(api, "GET").mockImplementation(async () => {
      return {
        data: [],
        response: new Response(null, { status: 200 }),
      } as unknown as ReturnType<typeof api.GET>;
    });

    const postSpy = vi.spyOn(api, "POST").mockImplementation(async () => {
      return {
        data: { ok: true },
        response: new Response(null, { status: 200 }),
      } as unknown as ReturnType<typeof api.POST>;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <InventoryPage />
      </QueryClientProvider>
    );

    const input = screen.getByLabelText("New inventory entry");
    const addBtn = screen.getByRole("button", { name: "Add to Inventory" });

    await user.type(input, "vllm: high-throughput serving");
    await user.click(addBtn);

    expect(postSpy).toHaveBeenCalledWith("/api/inventory", {
      body: { text: "vllm: high-throughput serving" },
    });
    expect(toast.success).toHaveBeenCalledWith("Added to inventory.");
  });

  it("renders empty state message when no items exist", async () => {
    vi.spyOn(api, "GET").mockImplementation(async () => {
      return {
        data: [],
        response: new Response(null, { status: 200 }),
      } as unknown as ReturnType<typeof api.GET>;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <InventoryPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText(/No inventory items recorded/)).toBeInTheDocument();
  });
});
