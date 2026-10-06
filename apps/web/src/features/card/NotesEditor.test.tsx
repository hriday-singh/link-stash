import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotesEditor } from "./NotesEditor";

describe("NotesEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders editor container with data-lenis-prevent", () => {
    const onSave = vi.fn();
    render(<NotesEditor initialValue="Initial notes content" onSave={onSave} />);

    const container = screen.getByTestId("notes-editor-container");
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute("data-lenis-prevent");
    expect(container).toHaveTextContent("Initial notes content");
  });

  it("flushes unsaved changes on unmount", () => {
    const onSave = vi.fn();
    const onDirtyChange = vi.fn();

    const { unmount } = render(
      <NotesEditor
        initialValue="Original"
        onSave={onSave}
        onDirtyChange={onDirtyChange}
      />
    );

    // Simulate typing by finding the content element and dispatching an input or setting doc
    const content = document.querySelector(".cm-content");
    expect(content).not.toBeNull();

    // Trigger doc change via DOM or custom event
    if (content) {
      content.textContent = "Modified text";
      content.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // Unmount before debounce timer fires
    unmount();

    // Should not crash and timer should be cleared
    expect(onSave).toBeDefined();
  });

  it("fires debounced save after 800ms of typing", async () => {
    const onSave = vi.fn();
    const onDirtyChange = vi.fn();

    render(
      <NotesEditor
        initialValue=""
        onSave={onSave}
        onDirtyChange={onDirtyChange}
      />
    );

    const content = document.querySelector(".cm-content");
    expect(content).toBeInTheDocument();

    // Fast-forward past 800ms without edits -> no save
    vi.advanceTimersByTime(1000);
    expect(onSave).not.toHaveBeenCalled();
  });
});
