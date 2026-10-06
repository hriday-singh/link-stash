import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

export type CardDetail = components["schemas"]["CardDetail"];
export type CardPatch = components["schemas"]["CardPatch"];
export type CardTile = components["schemas"]["CardTile"];
export type CardLinks = components["schemas"]["CardLinks"];
export type MetaResponse = components["schemas"]["MetaResponse"];
export type SearchHit = components["schemas"]["SearchHit"];
export type SourceRow = components["schemas"]["SourceRow"];
export type SourceDetail = components["schemas"]["SourceDetail"];
export type PageSourceRow = components["schemas"]["Page_SourceRow_"];
export type PendingItem = components["schemas"]["PendingItem"];
export type RejectEntry = components["schemas"]["RejectEntry"];
export type InventoryEntry = components["schemas"]["InventoryEntry"];
export type GraphData = components["schemas"]["GraphData"];
export type GraphNode = components["schemas"]["GraphNode"];
export type GraphEdge = components["schemas"]["GraphEdge"];

/**
 * Custom error thrown by unwrap() when an API call fails.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type FetchFn = typeof fetch;

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: FetchFn;
}

/**
 * Creates an openapi-fetch client with optional baseUrl and dynamic or custom fetch implementation.
 */
export function createApiClient(options: ApiClientOptions = {}) {
  const { baseUrl = "", fetch: customFetch } = options;
  return createClient<paths>({
    baseUrl,
    fetch: customFetch ?? ((...args) => globalThis.fetch(...args)),
  });
}

/**
 * Default singleton type-safe Link Stash API client.
 */
export const api = createApiClient();

/**
 * Unwraps an openapi-fetch call, returning typed data on 2xx
 * or throwing an ApiError with status, code, message and details.
 */
export async function unwrap<T, E>(
  promise: Promise<{ data?: T; error?: E; response: Response }>,
): Promise<T> {
  const { data, error, response } = await promise;
  if (!response.ok || error !== undefined) {
    let code = "UNKNOWN_ERROR";
    let message = response.statusText || `Request failed with status ${response.status}`;
    let details: unknown = undefined;

    if (error && typeof error === "object") {
      const errObj =
        "error" in error && error.error && typeof error.error === "object"
          ? (error.error as Record<string, unknown>)
          : (error as Record<string, unknown>);

      if (typeof errObj.code === "string") code = errObj.code;
      if (typeof errObj.message === "string") message = errObj.message;
      if (errObj.details !== undefined) details = errObj.details;
    }

    throw new ApiError(response.status, code, message, details);
  }
  return data as T;
}
