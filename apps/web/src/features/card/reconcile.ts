export type ReconcileAction = "ignore" | "reload" | "conflict";

export interface ReconcileParams {
  serverHash: string;
  lastSavedHash: string | null;
  baseHash: string;
  isDirty: boolean;
}

/**
 * Determines action when a server hash change is detected:
 * - "ignore": Server hash matches our own recent save or initial base (no change).
 * - "reload": Server changed and there are no uncommitted local edits (silent reload).
 * - "conflict": Server changed and there are uncommitted local edits (show banner).
 */
export function reconcile({
  serverHash,
  lastSavedHash,
  baseHash,
  isDirty,
}: ReconcileParams): ReconcileAction {
  // 1. Own save echoed back via SSE
  if (lastSavedHash && serverHash === lastSavedHash) {
    return "ignore";
  }

  // 2. Server hash matches base hash (no remote changes)
  if (serverHash === baseHash) {
    return "ignore";
  }

  // 3. Foreign change while user has unsaved edits -> conflict
  if (isDirty) {
    return "conflict";
  }

  // 4. Foreign change with no local edits -> safe to reload
  return "reload";
}
