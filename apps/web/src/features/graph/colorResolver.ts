import { formatHex, parse } from "culori";
import { getCategoryToken } from "@/lib/categories";

/**
 * Resolves a CSS variable from document.documentElement to a #rrggbb hex string
 * that Sigma.js WebGL shaders can reliably parse.
 */
export function resolveCssVarToHex(varName: string, fallback = "#888888"): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }

  const cleanVar = varName.startsWith("--") ? varName : `--${varName}`;
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue(cleanVar).trim();

  if (!raw) {
    return fallback;
  }

  try {
    const parsed = parse(raw);
    if (!parsed) return fallback;
    return formatHex(parsed) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Maps a category, kind, or entity type string to a computed token hex color.
 */
export function resolveCategoryColor(categoryOrType: string): string {
  const normalized = categoryOrType.toLowerCase().trim();

  if (normalized === "source") {
    // Sources map to primary or warning token
    return resolveCssVarToHex("--warning", "#e6a23c");
  }

  if (normalized === "creator") {
    // Creators map to muted-foreground / secondary token
    return resolveCssVarToHex("--muted-foreground", "#8c8c8c");
  }

  // Resolve to defined CSS variable
  const token = getCategoryToken(normalized);
  return resolveCssVarToHex(`--${token}`, "#888888");
}

/**
 * Maps an edge type ("wikilink" | "source" | "overlap") to a computed token hex color.
 */
export function resolveEdgeColor(edgeType: string): string {
  switch (edgeType) {
    case "source":
      return resolveCssVarToHex("--warning", "#d97706");
    case "overlap":
      return resolveCssVarToHex("--cat-skills-plugins", "#3b82f6");
    case "wikilink":
    default:
      return resolveCssVarToHex("--border", "#d1d5db");
  }
}
