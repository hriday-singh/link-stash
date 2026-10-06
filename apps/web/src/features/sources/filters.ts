import { z } from "zod";

export const STAGES = ["raw", "extracted", "triaged"] as const;
export type Stage = (typeof STAGES)[number];

export const sourceFiltersSchema = z.object({
  platform: z.string().optional(),
  creator: z.string().optional(),
  stage: z.string().optional(),
  has_video: z
    .union([z.boolean(), z.string().transform((val) => val === "true" || val === "1")])
    .optional(),
  cursor: z.string().optional(),
});

export type SourceFilters = z.infer<typeof sourceFiltersSchema>;

/**
 * Parses URL search params or object into clean SourceFilters.
 */
export function parseSourceFilters(
  input: Record<string, unknown> | URLSearchParams
): SourceFilters {
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

  const sanitized: SourceFilters = {};

  if (typeof raw.platform === "string" && raw.platform.trim()) {
    sanitized.platform = raw.platform.trim();
  }

  if (typeof raw.creator === "string" && raw.creator.trim()) {
    sanitized.creator = raw.creator.trim();
  }

  if (typeof raw.stage === "string" && raw.stage.trim()) {
    sanitized.stage = raw.stage.trim();
  }

  if (raw.has_video === true || raw.has_video === "true" || raw.has_video === "1") {
    sanitized.has_video = true;
  }

  if (typeof raw.cursor === "string" && raw.cursor.trim()) {
    sanitized.cursor = raw.cursor.trim();
  }

  return sanitized;
}

/**
 * Serializes filters into URL string params.
 */
export function serializeSourceFilters(filters: SourceFilters): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.platform) params.platform = filters.platform;
  if (filters.creator) params.creator = filters.creator;
  if (filters.stage) params.stage = filters.stage;
  if (filters.has_video) params.has_video = "true";
  if (filters.cursor) params.cursor = filters.cursor;

  return params;
}
