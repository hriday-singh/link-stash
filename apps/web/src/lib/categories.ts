export const SEED_CATEGORIES = [
  "models",
  "skills-plugins",
  "mcp-servers",
  "repos-tools",
  "ui-ux",
  "practices",
] as const;

/** Color tokens come from the API (`cat-models`, `cat-extra-3`); anything else falls back. */
export function isCategoryToken(token: string): boolean {
  return /^cat-[a-z0-9-]+$/.test(token);
}

export function categoryColorVar(token: string): string {
  return `var(--${isCategoryToken(token) ? token : "cat-extra-8"})`;
}

/** Lowercase slug; null when valid, else the message to show. */
export function categoryNameError(name: string, existing: readonly string[]): string | null {
  if (!name) return "Name is required.";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return "Use lowercase letters, numbers and dashes.";
  if (existing.includes(name)) return "That category already exists.";
  return null;
}
