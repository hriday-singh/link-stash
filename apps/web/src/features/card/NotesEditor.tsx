import { useEffect, useRef } from "react";
import { autocompletion } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { createWikilinkCompletion, defaultFetchCards, type CardSuggestion } from "./wikilinkCompletion";

export interface NotesEditorProps {
  initialValue?: string;
  onSave: (notes: string) => Promise<void> | void;
  onDirtyChange?: (isDirty: boolean) => void;
  fetchCards?: (query: string) => Promise<CardSuggestion[]>;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}

const stashEditorTheme = EditorView.theme({
  "&": {
    fontSize: "0.875rem",
    lineHeight: "1.5",
    color: "var(--foreground)",
    backgroundColor: "transparent",
    minHeight: "140px",
  },
  ".cm-content": {
    caretColor: "var(--primary)",
    fontFamily: "var(--font-sans, inherit)",
    padding: "0.75rem 0.5rem",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--primary)",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--muted)",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "inherit",
  },
  ".cm-placeholder": {
    color: "var(--muted-foreground)",
    fontStyle: "italic",
  },
  ".cm-tooltip-autocomplete": {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    color: "var(--popover-foreground)",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    padding: "4px 8px",
    fontSize: "0.75rem",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--muted)",
    color: "var(--foreground)",
  },
});

export function NotesEditor({
  initialValue = "",
  onSave,
  onDirtyChange,
  fetchCards = defaultFetchCards,
  placeholder = "Add your personal notes... Type [[ to link another card",
  className = "",
  readOnly = false,
}: NotesEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const onSaveRef = useRef(onSave);
  const onDirtyChangeRef = useRef(onDirtyChange);

  useEffect(() => {
    onSaveRef.current = onSave;
    onDirtyChangeRef.current = onDirtyChange;
  }, [onSave, onDirtyChange]);

  const dirtyRef = useRef(false);
  const valueRef = useRef(initialValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external changes to editor if editor is not dirty
  useEffect(() => {
    if (viewRef.current && !dirtyRef.current && initialValue !== valueRef.current) {
      valueRef.current = initialValue;
      const currentDoc = viewRef.current.state.doc.toString();
      if (currentDoc !== initialValue) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: initialValue },
        });
      }
    }
  }, [initialValue]);

  useEffect(() => {
    if (!containerRef.current) return;

    const wikilinkSource = createWikilinkCompletion(fetchCards);

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const text = update.state.doc.toString();
        valueRef.current = text;

        if (!dirtyRef.current) {
          dirtyRef.current = true;
          onDirtyChangeRef.current?.(true);
        }

        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        // 800 ms autosave debounce per spec
        timerRef.current = setTimeout(() => {
          if (dirtyRef.current) {
            dirtyRef.current = false;
            onDirtyChangeRef.current?.(false);
            void onSaveRef.current(valueRef.current);
          }
        }, 800);
      }
    });

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        autocompletion({ override: [wikilinkSource] }),
        EditorView.lineWrapping,
        cmPlaceholder(placeholder),
        EditorState.readOnly.of(readOnly),
        stashEditorTheme,
        updateListener,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Flush on page unload if dirty
    const handleBeforeUnload = () => {
      if (dirtyRef.current) {
        void onSaveRef.current(valueRef.current);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);

      // Flush pending autosave on unmount if dirty
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (dirtyRef.current) {
        dirtyRef.current = false;
        onDirtyChangeRef.current?.(false);
        void onSaveRef.current(valueRef.current);
      }

      view.destroy();
      viewRef.current = null;
    };
  }, [fetchCards, initialValue, placeholder, readOnly]);

  return (
    <div
      data-lenis-prevent
      data-testid="notes-editor-container"
      className={`rounded-lg border border-border bg-card text-foreground transition-colors focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-ring ${className}`}
    >
      <div ref={containerRef} className="overflow-hidden rounded-lg" />
    </div>
  );
}
