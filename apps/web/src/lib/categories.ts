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
