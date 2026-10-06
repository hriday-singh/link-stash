import { describe, expect, it, vi } from "vitest";
import { createStashQueryClient } from "./query";
import { ApiError } from "@/api/client";

describe("StashQueryProvider and QueryClient", () => {
  it("notifies via toast on query error", async () => {
    const toastMock = vi.fn();
    const client = createStashQueryClient(toastMock);

    // Trigger a query that throws an ApiError
    try {
      await client.fetchQuery({
        queryKey: ["test-error"],
        queryFn: async () => {
          throw new ApiError(500, "SERVER_ERROR", "Internal Server Error");
        },
        retry: false,
      });
    } catch {
      // expected
    }

    expect(toastMock).toHaveBeenCalledWith("Internal Server Error");
  });

  it("handles non-ApiError instances gracefully", async () => {
    const toastMock = vi.fn();
    const client = createStashQueryClient(toastMock);

    try {
      await client.fetchQuery({
        queryKey: ["test-generic-error"],
        queryFn: async () => {
          throw new Error("Network timeout");
        },
        retry: false,
      });
    } catch {
      // expected
    }

    expect(toastMock).toHaveBeenCalledWith("Network timeout");
  });
});
