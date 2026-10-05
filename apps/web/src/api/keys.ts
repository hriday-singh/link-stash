/**
 * Central query key factory for TanStack Query across Link Stash.
 */
export const queryKeys = {
  all: ["stash"] as const,
  cards: (filters?: Record<string, unknown>) => ["cards", filters ?? {}] as const,
  card: (slug: string) => ["card", slug] as const,
  cardLinks: (slug: string) => ["cardLinks", slug] as const,
  sources: (filters?: Record<string, unknown>) => ["sources", filters ?? {}] as const,
  source: (id: string) => ["source", id] as const,
  pending: () => ["pending"] as const,
  rejects: () => ["rejects"] as const,
  inventory: () => ["inventory"] as const,
  meta: () => ["meta"] as const,
  search: (q: string) => ["search", q] as const,
  graph: (params?: Record<string, unknown>) => ["graph", params ?? {}] as const,
};
