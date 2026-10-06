/**
 * Wikilink preprocessing and URL safety utilities for Link Stash card bodies.
 */

// Matches code blocks, inline code, or [[slug]] / [[slug|alias]]
const WIKILINK_TOKEN_REGEX =
  /(```[\s\S]*?```|`[^`\n]*`)|\[\[([a-zA-Z0-9_\-./]+)(?:\|([^\]\n]+))?\]\]/g;

/**
 * Preprocesses wikilinks [[slug]] and [[slug|alias]] into markdown link syntax:
 * - Resolved: `[displayText](/c/slug)`
 * - Unresolved: `[displayText](#stash-unresolved:slug)`
 * Preserves code blocks and inline code untouched.
 */
export function preprocessWikilinks(
  content: string,
  resolved: Record<string, string> = {}
): string {
  if (!content) return "";

  return content.replace(
    WIKILINK_TOKEN_REGEX,
    (_match, codeSegment, slugMatch, aliasMatch) => {
      // If inside code block or inline code, keep untouched
      if (codeSegment) {
        return codeSegment;
      }

      const slug = (slugMatch || "").trim();
      const alias = aliasMatch?.trim();
      const isResolved = Object.prototype.hasOwnProperty.call(resolved, slug);

      if (isResolved) {
        const displayText = alias || resolved[slug] || slug;
        return `[${displayText}](/c/${slug})`;
      } else {
        const displayText = alias || slug;
        return `[${displayText}](#stash-unresolved:${slug})`;
      }
    }
  );
}

/**
 * Checks whether a URL is safe to open in the browser.
 * Disallows javascript:, data:, and vbscript: protocols.
 */
export function isSafeUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (/^\s*(javascript|data|vbscript):/i.test(trimmed)) {
    return false;
  }
  return true;
}
