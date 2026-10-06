import { useState } from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MainScroll } from "@/components/MainScroll";
import { Toaster } from "@/components/ui/sonner";
import { CommandPalette } from "@/features/search/CommandPalette";
import { useLiveSync } from "@/lib/useLiveSync";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { status } = useLiveSync();

  return (
    <AppShell onOpenPalette={() => setPaletteOpen(true)} syncStatus={status}>
      <MainScroll>
        <Outlet />
      </MainScroll>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <Toaster position="bottom-right" />
    </AppShell>
  );
}
