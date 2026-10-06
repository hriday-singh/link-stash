import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import type { CardDetail, CardPatch } from "@/api/client";
import { useCardSave } from "./useCardSave";

function createMockCard(overrides: Partial<CardDetail> = {}): CardDetail {
  return {
    slug: "test-card",
    hash: "initial-hash",
    body: "## Body",
    notes: "Initial notes",
    resolved: {},
    card: {
      schema: 1,
      key: "test-card",
      title: "Test Card",
      category: "models",
      kind: "model",
      added: "2026-10-06",
      tags: [],
    },
    ...overrides,
  };
}

describe("useCardSave", () => {
  it("executes save using initialHash and updates state to saved", async () => {
    const saveCard = vi.fn().mockImplementation(async (_slug: string, patch: CardPatch) => {
      return createMockCard({ hash: "hash-v1", notes: patch.notes ?? "" });
    });

    const { result } = renderHook(() =>
      useCardSave({
        slug: "test-card",
        initialHash: "hash-initial",
        saveCard,
      })
    );

    expect(result.current.status).toBe("idle");
    expect(result.current.baseHash).toBe("hash-initial");

    await act(async () => {
      await result.current.save({ notes: "Updated notes" });
    });

    expect(saveCard).toHaveBeenCalledTimes(1);
    expect(saveCard).toHaveBeenCalledWith("test-card", {
      notes: "Updated notes",
      base_hash: "hash-initial",
    });
    expect(result.current.status).toBe("saved");
    expect(result.current.lastSavedHash).toBe("hash-v1");
    expect(result.current.baseHash).toBe("hash-v1");
  });

  it("serializes rapid sequential saves and chains hashes properly", async () => {
    const savedHashes: string[] = [];
    const saveCard = vi.fn().mockImplementation(async (_slug: string, patch: CardPatch) => {
      savedHashes.push(patch.base_hash);
      const newHash = `hash-${savedHashes.length}`;
      return createMockCard({ hash: newHash });
    });

    const { result } = renderHook(() =>
      useCardSave({
        slug: "test-card",
        initialHash: "hash-0",
        saveCard,
      })
    );

    // Trigger two saves simultaneously
    await act(async () => {
      const p1 = result.current.save({ notes: "note 1" });
      const p2 = result.current.save({ notes: "note 2" });
      await Promise.all([p1, p2]);
    });

    expect(saveCard).toHaveBeenCalledTimes(2);
    // First save used hash-0, second save must use hash-1 returned by first
    expect(savedHashes).toEqual(["hash-0", "hash-1"]);
    expect(result.current.lastSavedHash).toBe("hash-2");
    expect(result.current.status).toBe("saved");
  });

  it("transitions to conflict status on 409 error", async () => {
    const conflictError = new ApiError(409, "CONFLICT", "Hash mismatch", {
      current_hash: "server-hash-409",
      base_hash: "stale-hash",
    });

    const saveCard = vi.fn().mockRejectedValue(conflictError);

    const { result } = renderHook(() =>
      useCardSave({
        slug: "test-card",
        initialHash: "stale-hash",
        saveCard,
      })
    );

    await act(async () => {
      try {
        await result.current.save({ notes: "My conflicting edit" });
      } catch {
        // expected
      }
    });

    expect(result.current.status).toBe("conflict");
    expect(result.current.conflictHash).toBe("server-hash-409");
  });

  it("keepMine() re-sends pending patch with the conflict hash", async () => {
    let callCount = 0;
    const saveCard = vi.fn().mockImplementation(async (_slug: string, patch: CardPatch) => {
      callCount++;
      if (callCount === 1) {
        throw new ApiError(409, "CONFLICT", "Conflict", {
          current_hash: "foreign-hash-99",
        });
      }
      return createMockCard({ hash: "merged-hash-100", notes: patch.notes ?? "" });
    });

    const { result } = renderHook(() =>
      useCardSave({
        slug: "test-card",
        initialHash: "stale-hash",
        saveCard,
      })
    );

    // Initial save fails with 409
    await act(async () => {
      try {
        await result.current.save({ notes: "Important edit" });
      } catch {
        // expected
      }
    });

    expect(result.current.status).toBe("conflict");
    expect(result.current.conflictHash).toBe("foreign-hash-99");

    // User chooses "Keep mine"
    await act(async () => {
      await result.current.keepMine();
    });

    expect(saveCard).toHaveBeenCalledTimes(2);
    expect(saveCard).toHaveBeenLastCalledWith("test-card", {
      notes: "Important edit",
      base_hash: "foreign-hash-99",
    });
    expect(result.current.status).toBe("saved");
    expect(result.current.lastSavedHash).toBe("merged-hash-100");
  });

  it("reload() resets conflict state and triggers reload callback", () => {
    const onReload = vi.fn();
    const { result } = renderHook(() =>
      useCardSave({
        slug: "test-card",
        initialHash: "hash-0",
        onReloadRequest: onReload,
      })
    );

    act(() => {
      result.current.reload();
    });

    expect(result.current.status).toBe("idle");
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
