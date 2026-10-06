import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { startLiveSync, type SyncStatus } from "./sse";

interface LiveSyncContextValue {
  status: SyncStatus;
}

const LiveSyncContext = createContext<LiveSyncContextValue>({
  status: "connecting",
});

export function useLiveSync() {
  return useContext(LiveSyncContext);
}

export function LiveSyncProvider({
  children,
  url = "/api/events",
  disabled = false,
}: {
  children: ReactNode;
  url?: string;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>(() =>
    disabled ? "connected" : "connecting",
  );

  useEffect(() => {
    if (disabled || typeof window === "undefined") {
      return;
    }

    const cleanup = startLiveSync({
      url,
      queryClient,
      onStatusChange: setStatus,
    });

    return cleanup;
  }, [url, queryClient, disabled]);

  return (
    <LiveSyncContext.Provider value={{ status }}>
      {children}
    </LiveSyncContext.Provider>
  );
}
