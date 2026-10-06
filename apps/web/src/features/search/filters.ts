import { z } from "zod";
import { BUCKETS, type Bucket } from "@/lib/buckets";

export const VALID_KINDS = [
  "repo",
  "model",
  "skill",
  "plugin",
  "mcp",
  "tool",
  "ui_ref",
  "practice",
  "link",
] as const;

export type CardKind = (typeof VALID_KINDS)[number];

export const cardFiltersSchema = z.object({
  category: z.string().optional(),
  kind: z.enum(VALID_KINDS).optional(),
  tag: z.string().optional(),
  bucket: z.enum(BUCKETS).optional(),
  creator: z.string().optional(),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  has_video: z
    .union([z.boolean(), z.string().transform((val) => val === "true" || val === "1")])
    .optional(),
  q: z.string().optional(),
});

export type CardFilters = z.infer<typeof cardFiltersSchema>;

/**
 * Safely parses URL search params or record into clean CardFilters,
 * dropping any unknown or invalid parameters silently without throwing.
 */
export function parseCardFilters(
  input: Record<string, unknown> | URLSearchParams,
): CardFilters {
  const raw: Record<string, unknown> = {};

  if (input instanceof URLSearchParams) {
    input.forEach((val, key) => {
      if (val !== "") raw[key] = val;
    });
  } else {
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined && v !== null && v !== "") {
        raw[k] = v;
      }
    }
  }

  // Parse fields individually so partial valid params are retained even if one param is invalid
  const sanitized: CardFilters = {};

  if (typeof raw.category === "string" && raw.category.trim()) {
    sanitized.category = raw.category.trim();
  }

  if (
    typeof raw.kind === "string" &&
    VALID_KINDS.includes(raw.kind.toLowerCase() as CardKind)
  ) {
    sanitized.kind = raw.kind.toLowerCase() as CardKind;
  }

  if (typeof raw.tag === "string" && raw.tag.trim()) {
    sanitized.tag = raw.tag.trim();
  }

  if (typeof raw.bucket === "string" && BUCKETS.includes(raw.bucket as Bucket)) {
    sanitized.bucket = raw.bucket as Bucket;
  }

  if (typeof raw.creator === "string" && raw.creator.trim()) {
    sanitized.creator = raw.creator.trim();
  }

  if (typeof raw.since === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.since)) {
    sanitized.since = raw.since;
  }

  if (typeof raw.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.until)) {
    sanitized.until = raw.until;
  }

  if (raw.has_video === true || raw.has_video === "true" || raw.has_video === "1") {
    sanitized.has_video = true;
  }

  if (typeof raw.q === "string" && raw.q.trim()) {
    sanitized.q = raw.q.trim();
  }

  return sanitized;
}

/**
 * Serializes filters into a string record for URL navigation search params.
 */
export function serializeCardFilters(filters: CardFilters): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.category) params.category = filters.category;
  if (filters.kind) params.kind = filters.kind;
  if (filters.tag) params.tag = filters.tag;
  if (filters.bucket) params.bucket = filters.bucket;
  if (filters.creator) params.creator = filters.creator;
  if (filters.since) params.since = filters.since;
  if (filters.until) params.until = filters.until;
  if (filters.has_video) params.has_video = "true";
  if (filters.q) params.q = filters.q;

  return params;
}
