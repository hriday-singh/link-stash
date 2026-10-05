import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Menu01Icon,
  Moon02Icon,
  Search01Icon,
  Sun01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MorphIcon } from "@/components/ui/MorphIcon";
import { StashLogo } from "@/components/ui/StashLogo";
import { MockCard } from "@/mock/MockCard";
import { MockFeed, MockSidebar } from "@/mock/MockFeed";
import { MockGraph, MockInventory, MockPending, MockRejected, MockSources } from "@/mock/MockViews";
import { MOCK_CATEGORIES, MOCK_DAYS, type Category } from "@/mock/mock-data";
import { useTheme } from "@/state/theme";

const VIEWS = ["feed", "sources", "pending", "rejected", "inventory", "graph", "card"] as const;
export type AppView = (typeof VIEWS)[number];

interface NavState {
  view: AppView;
  category: string | null;
}

function parseHash(): NavState {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash.startsWith("cat-")) return { view: "feed", category: hash.slice(4) };
  const view = VIEWS.find((v) => v === hash);
  return { view: view ?? "feed", category: null };
}

export function App() {
  const [nav, setNav] = useState<NavState>(parseHash);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>(MOCK_CATEGORIES);
  const searchRef = useRef<HTMLInputElement>(null);
  const { resolved, toggle } = useTheme();

  useEffect(() => {
    const onHashChange = () => setNav(parseHash());
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const go = (next: NavState) => {
    setNav(next);
    window.location.hash = next.category ? `#cat-${next.category}` : `#${next.view}`;
    window.scrollTo({ top: 0 });
  };
  const selectView = (view: string) => go({ view: view as AppView, category: null });
  const openCard = () => go({ view: "card", category: null });

  const onSearch = (value: string) => {
    setQuery(value);
    if (nav.view !== "feed") go({ view: "feed", category: nav.category });
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur-md lg:px-0">
        <div className="flex shrink-0 items-center gap-2 lg:w-60 lg:px-5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          >
            <MorphIcon
              icon={mobileOpen ? Cancel01Icon : Menu01Icon}
              size={16}
              strokeWidth={1.5}
              spring="snappy"
            />
          </Button>
          <a
            href="#feed"
            onClick={(e) => {
              e.preventDefault();
              selectView("feed");
            }}
            className="flex items-center gap-2 rounded-md"
          >
            <StashLogo size={22} />
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">
              Link Stash
            </span>
          </a>
        </div>

        <div className="flex min-w-0 flex-1 justify-center lg:px-8">
          <div role="search" className="relative w-full max-w-xl">
            <HugeiconsIcon
              icon={Search01Icon}
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.5}
              aria-hidden
            />
            <Input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  e.currentTarget.blur();
                }
              }}
              placeholder="Search links, tags, categories…"
              aria-label="Search"
              className="h-9 bg-surface-sunken pl-9 text-xs sm:pr-16"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground sm:inline-flex">
              Ctrl K
            </kbd>
          </div>
        </div>

        <div className="flex shrink-0 items-center lg:pr-6">
          <Button
            variant="outline"
            size="icon"
            onClick={toggle}
            aria-label={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            <MorphIcon
              icon={resolved === "dark" ? Moon02Icon : Sun01Icon}
              size={16}
              strokeWidth={1.5}
              spring="snappy"
            />
          </Button>
        </div>
      </header>

      <div className="flex">
        <MockSidebar
          currentView={nav.view}
          onSelectView={selectView}
          categories={categories}
          onAddCategory={(c) => setCategories((prev) => [...prev, { ...c, count: 0 }])}
          selectedCategory={nav.category}
          onSelectCategory={(category) => go({ view: "feed", category })}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
            {nav.view === "feed" && (
              <MockFeed
                days={MOCK_DAYS}
                categories={categories}
                query={query}
                selectedCategory={nav.category}
                onClearCategory={() => go({ view: "feed", category: null })}
                onOpenCard={openCard}
              />
            )}
            {nav.view === "sources" && <MockSources onOpenCard={openCard} />}
            {nav.view === "pending" && <MockPending />}
            {nav.view === "rejected" && <MockRejected />}
            {nav.view === "inventory" && <MockInventory />}
            {nav.view === "graph" && <MockGraph categories={categories} onOpenCard={openCard} />}
            {nav.view === "card" && (
              <MockCard onBack={() => selectView("feed")} onReject={() => selectView("rejected")} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
