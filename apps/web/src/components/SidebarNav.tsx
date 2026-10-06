import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  CancelCircleIcon,
  Clock01Icon,
  GitForkIcon,
  Layers01Icon,
  Layout01Icon,
  SidebarLeftIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { useMeta } from "@/lib/useMeta";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TextMorph } from "@/components/ui/TextMorph";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  categoryColorVar,
  categoryNameError,
  getCategoryToken,
  SEED_CATEGORIES,
} from "@/lib/categories";
import { useSidebar } from "@/state/sidebar";

interface CategoryItem {
  name: string;
  color: string;
  count: number;
}

interface SidebarNavProps {
  isMobile?: boolean;
  onNavigate?: () => void;
  syncStatus?: "connected" | "connecting" | "disconnected";
}

export function SidebarNav({
  isMobile = false,
  onNavigate,
  syncStatus = "connected",
}: SidebarNavProps) {
  const { collapsed, toggleCollapsed } = useSidebar();
  const [addOpen, setAddOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catError, setCatError] = useState<string | null>(null);
  const [extraCategories, setExtraCategories] = useState<CategoryItem[]>([]);

  const { data: meta } = useMeta();

  const isCollapsed = !isMobile && collapsed;

  const initialCategories: CategoryItem[] = SEED_CATEGORIES.map((name) => ({
    name,
    color: `cat-${name}`,
    count: 0,
  }));

  const serverCategories: CategoryItem[] = meta?.categories?.map((c) => ({
    name: c.name,
    color: c.color,
    count: c.count,
  })) ?? initialCategories;

  // Merge server categories with any user-added extra categories
  const categories: CategoryItem[] = [
    ...serverCategories,
    ...extraCategories.filter(
      (ec) => !serverCategories.some((sc) => sc.name === ec.name),
    ),
  ];

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const existing = categories.map((c) => c.name);
    const err = categoryNameError(newCatName, existing);
    if (err) {
      setCatError(err);
      return;
    }

    setExtraCategories((prev) => [
      ...prev,
      {
        name: newCatName,
        color: getCategoryToken(newCatName),
        count: 0,
      },
    ]);
    setNewCatName("");
    setCatError(null);
    setAddOpen(false);
  };

  interface NavItem {
    to: "/" | "/sources" | "/pending" | "/rejected" | "/inventory" | "/graph";
    label: string;
    icon: typeof Layout01Icon;
    count?: number | undefined;
  }

  const navItems: NavItem[] = [
    { to: "/", label: "Feed", icon: Layout01Icon, count: meta?.counts?.cards },
    { to: "/sources", label: "Sources", icon: Video01Icon, count: meta?.counts?.sources },
    { to: "/pending", label: "Pending", icon: Clock01Icon, count: meta?.counts?.pending },
    { to: "/rejected", label: "Rejected", icon: CancelCircleIcon, count: meta?.counts?.rejected },
    { to: "/inventory", label: "Inventory", icon: Layers01Icon, count: meta?.counts?.inventory },
    { to: "/graph", label: "Graph", icon: GitForkIcon, count: undefined },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        data-slot="sidebar-nav"
        data-lenis-prevent
        className="flex h-full flex-col justify-between overflow-y-auto overflow-x-hidden p-2 text-xs"
      >
        <div className="flex flex-col gap-1">
          {/* Main Navigation Links */}
          <nav aria-label="Main Navigation" className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const link = (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  activeProps={{
                    className: "bg-muted font-medium text-foreground",
                  }}
                  inactiveProps={{
                    className: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  }}
                  className={`flex h-8 items-center gap-2.5 rounded-lg px-2.5 transition-colors ${
                    isCollapsed ? "justify-center px-0" : ""
                  }`}
                >
                  <HugeiconsIcon icon={item.icon} className="size-4 shrink-0" strokeWidth={1.5} />
                  {!isCollapsed && (
                    <span className="flex-1 truncate tracking-tight">{item.label}</span>
                  )}
                  {!isCollapsed && typeof item.count === "number" && item.count > 0 && (
                    <span className="ml-auto rounded-full bg-surface-sunken px-1.5 py-0.2 font-mono text-2xs text-muted-foreground">
                      <TextMorph>{item.count}</TextMorph>
                    </span>
                  )}
                </Link>
              );

              if (isCollapsed) {
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">
                      {item.label}
                      {typeof item.count === "number" && item.count > 0 ? ` (${item.count})` : ""}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return link;
            })}
          </nav>

          <Separator className="my-2" />

          {/* Categories List */}
          <div className="flex flex-col gap-1">
            <div
              className={`flex items-center px-2 py-1 text-2xs font-medium tracking-wider text-muted-foreground uppercase ${
                isCollapsed ? "justify-center" : "justify-between"
              }`}
            >
              {!isCollapsed && <span>Categories</span>}
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setAddOpen(true)}
                aria-label="Add category"
                className="size-5 rounded-md text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon icon={Add01Icon} className="size-3.5" strokeWidth={1.5} />
              </Button>
            </div>

            <nav aria-label="Categories" className="flex flex-col gap-0.5">
              {categories.map((cat) => {
                const link = (
                  <Link
                    key={cat.name}
                    to="/category/$name"
                    params={{ name: cat.name }}
                    onClick={onNavigate}
                    activeProps={{
                      className: "bg-muted font-medium text-foreground",
                    }}
                    inactiveProps={{
                      className: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    }}
                    className={`flex h-8 items-center gap-2.5 rounded-lg px-2.5 transition-colors ${
                      isCollapsed ? "justify-center px-0" : ""
                    }`}
                  >
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: categoryColorVar(cat.color) }}
                    />
                    {!isCollapsed && (
                      <span className="flex-1 truncate tracking-tight">{cat.name}</span>
                    )}
                    {!isCollapsed && typeof cat.count === "number" && cat.count > 0 && (
                      <span className="ml-auto font-mono text-2xs text-muted-foreground">
                        <TextMorph>{cat.count}</TextMorph>
                      </span>
                    )}
                  </Link>
                );

                if (isCollapsed) {
                  return (
                    <Tooltip key={cat.name}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">
                        {cat.name} {cat.count > 0 ? `(${cat.count})` : ""}
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                return link;
              })}
            </nav>
          </div>
        </div>

        {/* Footer Area: Sync status, Collapse toggle */}
        <div className="flex flex-col gap-1.5 pt-3">
          <Separator className="mb-1" />

          {/* Sync indicator */}
          <div
            className={`flex items-center gap-2 px-2 py-1 text-2xs text-muted-foreground ${
              isCollapsed ? "justify-center px-0" : ""
            }`}
          >
            <span
              className={`size-2 shrink-0 rounded-full ${
                syncStatus === "connected"
                  ? "bg-success shadow-xs"
                  : syncStatus === "connecting"
                    ? "animate-pulse bg-warning"
                    : "bg-destructive"
              }`}
            />
            {!isCollapsed && (
              <span className="truncate">
                {syncStatus === "connected"
                  ? "Live sync active"
                  : syncStatus === "connecting"
                    ? "Reconnecting..."
                    : "Offline"}
              </span>
            )}
          </div>

          {/* Desktop collapse toggle */}
          {!isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`flex h-8 items-center gap-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground ${
                isCollapsed ? "justify-center px-0" : "w-full justify-start px-2"
              }`}
            >
              <HugeiconsIcon
                icon={SidebarLeftIcon}
                className={`size-4 shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`}
                strokeWidth={1.5}
              />
              {!isCollapsed && <span className="truncate">Collapse sidebar</span>}
            </Button>
          )}
        </div>

        {/* Add Category Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle>Add Category</DialogTitle>
              <DialogDescription>
                Create a new category for organizing your stash cards.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateCategory} className="flex flex-col gap-3 py-2">
              <div className="flex flex-col gap-1.5">
                <Input
                  value={newCatName}
                  onChange={(e) => {
                    setNewCatName(e.target.value.toLowerCase());
                    setCatError(null);
                  }}
                  placeholder="e.g. workflows"
                  autoFocus
                  className="h-9 text-xs"
                />
                {catError && <p className="text-2xs text-destructive">{catError}</p>}
              </div>

              <DialogFooter className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Create category
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </aside>
    </TooltipProvider>
  );
}
