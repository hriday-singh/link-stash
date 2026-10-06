import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/keys";

export interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

export type SyncStatus = "connected" | "connecting" | "disconnected";

/**
 * EventTarget for dispatching card-specific live events (consumed by B3 card editing).
 */
export const cardEventTarget = new EventTarget();

export function dispatchCardEvent(event: string, data: Record<string, unknown>) {
  cardEventTarget.dispatchEvent(
    new CustomEvent(event, { detail: data }),
  );
}

/**
 * Maps a domain SSE event to the list of TanStack Query key prefixes to invalidate.
 */
export function keysForEvent(event: string, data: Record<string, unknown> = {}): readonly (readonly unknown[])[] {
  switch (event) {
    case "card.changed":
    case "card.deleted": {
      const slug = typeof data.slug === "string" ? data.slug : undefined;
      const keys: (readonly unknown[])[] = [
        queryKeys.cards(),
        queryKeys.graph(),
        ["search"],
        queryKeys.meta(),
      ];
      if (slug) {
        keys.push(queryKeys.card(slug));
        keys.push(queryKeys.cardLinks(slug));
      }
      return keys;
    }

    case "source.changed": {
      const id = typeof data.id === "string" ? data.id : undefined;
      const keys: (readonly unknown[])[] = [
        queryKeys.sources(),
        queryKeys.cards(),
        queryKeys.graph(),
      ];
      if (id) {
        keys.push(queryKeys.source(id));
      }
      return keys;
    }

    case "state.changed":
      return [
        queryKeys.pending(),
        queryKeys.rejects(),
        queryKeys.inventory(),
        queryKeys.meta(),
      ];

    case "index.rebuilt":
      return [
        queryKeys.all,
        queryKeys.cards(),
        queryKeys.sources(),
        queryKeys.pending(),
        queryKeys.rejects(),
        queryKeys.inventory(),
        queryKeys.meta(),
        queryKeys.graph(),
        ["search"],
      ];

    default:
      return [];
  }
}

export interface LiveSyncOptions {
  url?: string;
  queryClient: QueryClient;
  onStatusChange?: (status: SyncStatus) => void;
  eventSourceFactory?: (url: string) => EventSource;
}

/**
 * Creates and manages an SSE connection with exponential backoff and query invalidation.
 */
export function startLiveSync({
  url = "/api/events",
  queryClient,
  onStatusChange,
  eventSourceFactory,
}: LiveSyncOptions): () => void {
  let source: EventSource | null = null;
  let retryCount = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let isClosed = false;

  const setStatus = (status: SyncStatus) => {
    onStatusChange?.(status);
  };

  const connect = () => {
    if (isClosed) return;

    setStatus(retryCount === 0 ? "connecting" : "connecting");

    const createSource =
      eventSourceFactory ??
      ((targetUrl: string) => new EventSource(targetUrl));

    try {
      source = createSource(url);
    } catch {
      scheduleReconnect();
      return;
    }

    source.onopen = () => {
      setStatus("connected");
      if (retryCount > 0) {
        // Refetch everything on successful reconnection after dropped connection
        queryClient.invalidateQueries();
      }
      retryCount = 0;
    };

    source.onerror = () => {
      if (source) {
        source.close();
        source = null;
      }
      setStatus("connecting");
      scheduleReconnect();
    };

    // Generic message handler
    source.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as Record<string, unknown>;
        handleEvent("message", parsed);
      } catch {
        // ignore parse error
      }
    };

    const addNamedListener = (eventType: string) => {
      source?.addEventListener(eventType, (e: Event) => {
        const messageEvent = e as MessageEvent;
        try {
          const parsed = JSON.parse(messageEvent.data) as Record<string, unknown>;
          handleEvent(eventType, parsed);
        } catch {
          handleEvent(eventType, {});
        }
      });
    };

    addNamedListener("card.changed");
    addNamedListener("card.deleted");
    addNamedListener("source.changed");
    addNamedListener("state.changed");
    addNamedListener("index.rebuilt");
  };

  const handleEvent = (event: string, data: Record<string, unknown>) => {
    if (event === "card.changed" || event === "card.deleted") {
      dispatchCardEvent(event, data);
    }

    const invalidationKeys = keysForEvent(event, data);
    for (const key of invalidationKeys) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const scheduleReconnect = () => {
    if (isClosed) return;
    const delay = Math.min(1000 * Math.pow(1.5, retryCount), 30000);
    retryCount++;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (!isClosed) connect();
    }, delay);
  };

  connect();

  return () => {
    isClosed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (source) {
      source.close();
      source = null;
    }
    setStatus("disconnected");
  };
}
