import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, unwrap } from "@/api/client";
import type { CardDetail, CardPatch } from "@/api/client";

export type CardSaveStatus = "idle" | "saving" | "saved" | "conflict" | "error";

export type SaveablePatch = Omit<CardPatch, "base_hash">;

export interface UseCardSaveOptions {
  slug: string;
  initialHash: string;
  onSaveSuccess?: (updated: CardDetail) => void;
  onReloadRequest?: () => void;
  /** Custom saver for testing or override */
  saveCard?: (slug: string, patch: CardPatch) => Promise<CardDetail>;
}

export function useCardSave({
  slug,
  initialHash,
  onSaveSuccess,
  onReloadRequest,
  saveCard,
}: UseCardSaveOptions) {
  const [status, setStatus] = useState<CardSaveStatus>("idle");
  const [error, setError] = useState<unknown>(null);
  const [conflictHash, setConflictHash] = useState<string | null>(null);
  const [lastSavedHash, setLastSavedHash] = useState<string | null>(null);
  const [pendingPatch, setPendingPatch] = useState<SaveablePatch | null>(null);
  const [activeBaseHash, setActiveBaseHash] = useState<string | null>(null);

  const baseHash = activeBaseHash ?? initialHash;
  const baseHashRef = useRef(initialHash);

  useEffect(() => {
    baseHashRef.current = initialHash;
  }, [initialHash]);

  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const defaultSaveCard = useCallback(
    async (targetSlug: string, patch: CardPatch): Promise<CardDetail> => {
      return await unwrap(
        api.PUT("/api/cards/{slug}", {
          params: { path: { slug: targetSlug } },
          body: patch,
        }),
      );
    },
    [],
  );

  const executeSave = saveCard ?? defaultSaveCard;

  const save = useCallback(
    (patch: SaveablePatch): Promise<CardDetail> => {
      setError(null);

      const queuedOperation = queueRef.current
        .catch(() => {
          // Allow subsequent saves to proceed even if previous one failed
        })
        .then(async () => {
          setStatus("saving");
          const currentBase = baseHashRef.current;
          const fullPatch: CardPatch = {
            ...patch,
            base_hash: currentBase,
          };

          try {
            const updated = await executeSave(slug, fullPatch);
            setActiveBaseHash(updated.hash);
            baseHashRef.current = updated.hash;
            setLastSavedHash(updated.hash);
            setStatus("saved");
            setConflictHash(null);
            setPendingPatch(null);
            onSaveSuccess?.(updated);
            return updated;
          } catch (err: unknown) {
            if (err instanceof ApiError && err.status === 409) {
              const details = err.details as
                { current_hash?: string; base_hash?: string } | undefined;
              const serverHash = details?.current_hash || "";
              setConflictHash(serverHash);
              setPendingPatch(patch);
              setStatus("conflict");
            } else {
              setStatus("error");
            }
            setError(err);
            throw err;
          }
        });

      queueRef.current = queuedOperation;
      return queuedOperation;
    },
    [executeSave, onSaveSuccess, slug],
  );

  const keepMine = useCallback(async (): Promise<CardDetail | void> => {
    if (!conflictHash || !pendingPatch) return;
    setActiveBaseHash(conflictHash);
    baseHashRef.current = conflictHash;
    setStatus("idle");
    return save(pendingPatch);
  }, [conflictHash, pendingPatch, save]);

  const reload = useCallback(() => {
    setStatus("idle");
    setError(null);
    setConflictHash(null);
    setPendingPatch(null);
    setActiveBaseHash(null);
    baseHashRef.current = initialHash;
    onReloadRequest?.();
  }, [initialHash, onReloadRequest]);

  return {
    status,
    error,
    conflictHash,
    lastSavedHash,
    baseHash,
    save,
    keepMine,
    reload,
  };
}
