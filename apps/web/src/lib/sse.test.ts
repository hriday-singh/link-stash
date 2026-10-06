import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { keysForEvent, startLiveSync } from "./sse";

describe("SSE live sync", () => {
  it("maps domain events to corresponding query keys", () => {
    const cardKeys = keysForEvent("card.changed", { slug: "agent-kit" });
    expect(cardKeys).toContainEqual(["cards", {}]);
    expect(cardKeys).toContainEqual(["card", "agent-kit"]);
    expect(cardKeys).toContainEqual(["cardLinks", "agent-kit"]);

    const sourceKeys = keysForEvent("source.changed", { id: "source-1" });
    expect(sourceKeys).toContainEqual(["sources", {}]);
    expect(sourceKeys).toContainEqual(["source", "source-1"]);

    const stateKeys = keysForEvent("state.changed", { file: "pending.md" });
    expect(stateKeys).toContainEqual(["pending"]);
    expect(stateKeys).toContainEqual(["rejects"]);

    const reindexKeys = keysForEvent("index.rebuilt");
    expect(reindexKeys).toContainEqual(["stash"]);
  });

  it("handles event source connection and error reconnection backoff", () => {
    vi.useFakeTimers();

    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const statusChanges: string[] = [];

    // Mock EventSource
    let instanceCount = 0;
    class MockEventSource {
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((e: MessageEvent) => void) | null = null;
      close = vi.fn();
      addEventListener = vi.fn();

      constructor(_url?: string) {
        void _url;
        instanceCount++;
      }
    }

    let mockSource: MockEventSource | undefined;

    const cleanup = startLiveSync({
      url: "/api/events",
      queryClient,
      onStatusChange: (status) => statusChanges.push(status),
      eventSourceFactory: (url) => {
        mockSource = new MockEventSource(url);
        return mockSource as unknown as EventSource;
      },
    });

    expect(statusChanges).toContain("connecting");

    // Simulate open
    (mockSource as MockEventSource).onopen?.();
    expect(statusChanges).toContain("connected");

    // Simulate drop / error
    (mockSource as MockEventSource).onerror?.();
    expect((mockSource as MockEventSource).close).toHaveBeenCalled();

    // Fast-forward backoff timer
    vi.advanceTimersByTime(1500);

    // Reconnected
    expect(instanceCount).toBe(2);
    (mockSource as MockEventSource).onopen?.();
    expect(invalidateSpy).toHaveBeenCalled();

    cleanup();
    expect(statusChanges[statusChanges.length - 1]).toBe("disconnected");

    vi.useRealTimers();
  });
});
