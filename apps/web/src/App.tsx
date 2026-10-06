import { RouterProvider } from "@tanstack/react-router";
import { LiveSyncProvider } from "./lib/useLiveSync";
import { createStashRouter } from "./router";
import { StashQueryProvider } from "./state/query";
import { SidebarProvider } from "./state/sidebar";

interface AppProps {
  router?: ReturnType<typeof createStashRouter>;
}

export function App({ router }: AppProps) {
  const activeRouter = router ?? createStashRouter();

  return (
    <StashQueryProvider>
      <LiveSyncProvider>
        <SidebarProvider>
          <RouterProvider router={activeRouter} />
        </SidebarProvider>
      </LiveSyncProvider>
    </StashQueryProvider>
  );
}
