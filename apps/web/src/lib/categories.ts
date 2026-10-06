export const SEED_CATEGORIES = [
  "models",
  "skills-plugins",
  "mcp-servers",
  "repos-tools",
  "ui-ux",
  "practices",
] as const;

export const CATEGORY_TOKENS = [
  ...SEED_CATEGORIES.map((c) => `cat-${c}`),
  ...Array.from({ length: 8 }, (_, i) => `cat-extra-${i + 1}`),
] as const;

const VALID_CATEGORY_TOKENS = new Set<string>(CATEGORY_TOKENS);

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Resolves any category name or raw token to a valid CSS token defined in tokens.css. */
export function getCategoryToken(nameOrToken: string): string {
  const normalized = (nameOrToken || "").toLowerCase().trim();
  if (!normalized) return "cat-extra-8";

  // If already an explicitly defined token
  if (VALID_CATEGORY_TOKENS.has(normalized)) {
    return normalized;
  }

  // Strip cat- prefix if present
  const raw = normalized.startsWith("cat-") ? normalized.slice(4) : normalized;

  // Check if it's a seed category
  if (SEED_CATEGORIES.includes(raw as (typeof SEED_CATEGORIES)[number])) {
    return `cat-${raw}`;
  }

  // Check if it's already an extra token format (e.g. extra-1 to extra-8)
  const extraMatch = /^extra-([1-8])$/.exec(raw);
  if (extraMatch) {
    return `cat-${raw}`;
  }

  // Deterministically map unknown categories to a vibrant extra token (cat-extra-1 to cat-extra-7)
  const index = (hashString(raw) % 7) + 1;
  return `cat-extra-${index}`;
}

/** Returns true if token is one of the explicitly defined category tokens in tokens.css. */
export function isCategoryToken(token: string): boolean {
  return VALID_CATEGORY_TOKENS.has(token);
}

/** Returns a CSS variable expression var(--cat-...) that is guaranteed to exist. */
export function categoryColorVar(tokenOrName: string): string {
  const token = getCategoryToken(tokenOrName);
  return `var(--${token})`;
}

/** Lowercase slug; null when valid, else the message to show. */
export function categoryNameError(name: string, existing: readonly string[]): string | null {
  if (!name) return "Name is required.";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return "Use lowercase letters, numbers and dashes.";
  if (existing.includes(name)) return "That category already exists.";
  return null;
}
