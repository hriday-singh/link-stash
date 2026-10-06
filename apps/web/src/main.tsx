import "@/styles/tokens.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { LiveSyncProvider } from "./lib/useLiveSync";
import { createStashRouter } from "./router";
import { StashQueryProvider } from "./state/query";
import { SidebarProvider } from "./state/sidebar";
import { ThemeProvider } from "./state/theme";

const router = createStashRouter();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <StashQueryProvider>
        <LiveSyncProvider>
          <SidebarProvider>
            <RouterProvider router={router} />
          </SidebarProvider>
        </LiveSyncProvider>
      </StashQueryProvider>
    </ThemeProvider>
  </StrictMode>,
);
