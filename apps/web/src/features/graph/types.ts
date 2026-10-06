export interface GraphSearchFilters {
  category?: string;
  edge_type?: "wikilink" | "source" | "overlap";
}

export function parseGraphSearch(search: Record<string, unknown>): GraphSearchFilters {
  return {
    category: typeof search.category === "string" && search.category ? search.category : undefined,
    edge_type:
      search.edge_type === "wikilink" ||
      search.edge_type === "source" ||
      search.edge_type === "overlap"
        ? search.edge_type
        : undefined,
  };
}
