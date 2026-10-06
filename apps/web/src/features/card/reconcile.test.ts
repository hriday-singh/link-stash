import { describe, expect, it } from "vitest";
import { reconcile } from "./reconcile";

describe("reconcile", () => {
  it("ignores event if serverHash matches lastSavedHash (own save echoed back)", () => {
    const result = reconcile({
      serverHash: "hash-saved-123",
      lastSavedHash: "hash-saved-123",
      baseHash: "hash-saved-123",
      isDirty: true,
    });
    expect(result).toBe("ignore");
  });

  it("ignores event if serverHash matches baseHash (no change)", () => {
    const result = reconcile({
      serverHash: "hash-base-000",
      lastSavedHash: null,
      baseHash: "hash-base-000",
      isDirty: false,
    });
    expect(result).toBe("ignore");
  });

  it("returns reload if server hash differs and local card is not dirty", () => {
    const result = reconcile({
      serverHash: "hash-remote-999",
      lastSavedHash: "hash-local-111",
      baseHash: "hash-local-111",
      isDirty: false,
    });
    expect(result).toBe("reload");
  });

  it("returns conflict if server hash differs and user has unsaved edits (dirty)", () => {
    const result = reconcile({
      serverHash: "hash-remote-999",
      lastSavedHash: "hash-local-111",
      baseHash: "hash-local-111",
      isDirty: true,
    });
    expect(result).toBe("conflict");
  });

  it("returns conflict when dirty even if lastSavedHash is null", () => {
    const result = reconcile({
      serverHash: "hash-remote-new",
      lastSavedHash: null,
      baseHash: "hash-original",
      isDirty: true,
    });
    expect(result).toBe("conflict");
  });
});
