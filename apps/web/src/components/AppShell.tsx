import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Menu01Icon,
  Moon02Icon,
  Search01Icon,
  Sun01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { MorphIcon } from "@/components/ui/MorphIcon";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StashLogo } from "@/components/ui/StashLogo";
import { SidebarNav } from "@/components/SidebarNav";
import { useSidebar } from "@/state/sidebar";
import { useTheme } from "@/state/theme";

interface AppShellProps {
  children: ReactNode;
  onOpenPalette?: () => void;
  syncStatus?: "connected" | "connecting" | "disconnected";
}

export function AppShell({
  children,
  onOpenPalette,
  syncStatus = "connected",
}: AppShellProps) {
  const { width, collapsed, mobileOpen, setMobileOpen, startResizing } = useSidebar();
  const { resolved, toggle: toggleTheme } = useTheme();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur-md lg:px-4">
        {/* Mobile menu button & Brand */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <HugeiconsIcon icon={Menu01Icon} className="size-4" strokeWidth={1.5} />
          </Button>

          <Link to="/" className="flex items-center gap-2 rounded-md outline-hidden">
            <StashLogo size={22} />
            <span className="text-sm font-semibold tracking-tight">Link Stash</span>
          </Link>
        </div>

        {/* Global Search / Command Palette Trigger */}
        <div className="flex min-w-0 flex-1 justify-center px-2 sm:px-6">
          <button
            type="button"
            onClick={onOpenPalette}
            className="group relative flex h-9 w-full max-w-xl cursor-pointer items-center justify-between rounded-lg border bg-surface-sunken px-3 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-muted/80 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden"
            aria-label="Search or run commands"
          >
            <div className="flex items-center gap-2 truncate">
              <HugeiconsIcon
                icon={Search01Icon}
                className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                strokeWidth={1.5}
                aria-hidden
              />
              <span className="truncate">Search links, tags, categories…</span>
            </div>
            <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground sm:inline-flex">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Top Right Controls: Theme Toggle */}
        <div className="flex shrink-0 items-center">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={toggleTheme}
            aria-label={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="rounded-lg"
          >
            <MorphIcon
              icon={resolved === "dark" ? Moon02Icon : Sun01Icon}
              size={15}
              strokeWidth={1.5}
              spring="snappy"
            />
          </Button>
        </div>
      </header>

      {/* Main Body Shell */}
      <div className="flex min-h-[calc(100dvh-3.5rem)]">
        {/* Desktop Sidebar (collapsible + resizable) */}
        <div
          data-slot="desktop-sidebar-container"
          style={{ width: collapsed ? 56 : width }}
          className="relative hidden shrink-0 border-r transition-[width] duration-150 ease-out lg:flex lg:flex-col"
        >
          <div className="sticky top-14 h-[calc(100dvh-3.5rem)] w-full overflow-hidden">
            <SidebarNav syncStatus={syncStatus} />
          </div>

          {/* Drag Resize Handle (only when expanded) */}
          {!collapsed && (
            <div
              onMouseDown={startResizing}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              className="absolute top-0 -right-1 z-20 h-full w-2 cursor-col-resize hover:bg-primary/20 active:bg-primary/40"
            />
          )}
        </div>

        {/* Mobile Navigation Drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b p-4">
              <SheetTitle className="flex items-center gap-2">
                <StashLogo size={20} />
                <span>Link Stash</span>
              </SheetTitle>
              <SheetDescription className="sr-only">
                Main mobile navigation drawer
              </SheetDescription>
            </SheetHeader>
            <div className="h-[calc(100%-4rem)] overflow-y-auto">
              <SidebarNav
                isMobile
                syncStatus={syncStatus}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Main Content View Container */}
        <main className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
