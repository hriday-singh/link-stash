import type { CompletionContext, CompletionResult, CompletionSource } from "@codemirror/autocomplete";
import { api, unwrap } from "@/api/client";

export type CardSuggestion = {
  slug: string;
  title: string;
};

/**
 * Creates a CodeMirror 6 completion source that detects `[[` and suggests card links.
 */
export function createWikilinkCompletion(
  fetchCards: (query: string) => Promise<CardSuggestion[]>
): CompletionSource {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    // Match [[ followed by any non-bracket characters up to the cursor
    const word = context.matchBefore(/\[\[([^\]\n]*)$/);
    if (!word) {
      return null;
    }

    const query = word.text.slice(2).trim();
    const suggestions = await fetchCards(query);
    if (!suggestions || suggestions.length === 0) {
      return null;
    }

    return {
      from: word.from + 2,
      to: context.pos,
      options: suggestions.map((s) => ({
        label: s.title || s.slug,
        displayLabel: s.title || s.slug,
        detail: s.slug,
        apply: `${s.slug}]]`,
      })),
      filter: false,
    };
  };
}

/**
 * Default card suggestion fetcher querying FTS5 search or cards list via OpenAPI client.
 */
export async function defaultFetchCards(query: string): Promise<CardSuggestion[]> {
  try {
    if (query.trim()) {
      const hits = await unwrap(
        api.GET("/api/search", {
          params: { query: { q: query.trim(), limit: 10 } },
        })
      );
      return hits.map((h) => ({ slug: h.slug, title: h.title }));
    } else {
      const page = await unwrap(
        api.GET("/api/cards", {
          params: { query: { limit: 10 } },
        })
      );
      return page.items.map((c) => ({ slug: c.slug, title: c.title }));
    }
  } catch {
    return [];
  }
}
