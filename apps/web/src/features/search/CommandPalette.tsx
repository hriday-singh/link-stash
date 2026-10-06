import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CancelCircleIcon,
  Clock01Icon,
  GitForkIcon,
  Layers01Icon,
  Layout01Icon,
  Moon02Icon,
  RefreshIcon,
  Search01Icon,
  Sun01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { api, unwrap } from "@/api/client";
import { queryKeys } from "@/api/keys";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Snippet } from "@/features/search/Snippet";
import { useTheme } from "@/state/theme";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { resolved, toggle: toggleTheme } = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  // Debounce search input by 150ms per spec
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm.trim());
    }, 150);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Global Ctrl+K / Cmd+K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const { data: hits, isLoading } = useQuery({
    queryKey: queryKeys.search(debouncedTerm),
    queryFn: () =>
      unwrap(
        api.GET("/api/search", {
          params: { query: { q: debouncedTerm, limit: 10 } },
        }),
      ),
    enabled: debouncedTerm.length >= 2,
    staleTime: 1000 * 30,
  });

  const runAndClose = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  const handleReindex = async () => {
    try {
      await unwrap(api.POST("/api/reindex"));
      toast.success("Index rebuild triggered");
    } catch {
      toast.error("Failed to trigger index rebuild");
    }
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command Palette"
      description="Quickly search links or run commands"
    >
      <CommandInput
        placeholder="Type a command or search cards…"
        value={searchTerm}
        onValueChange={setSearchTerm}
      />
      <CommandList data-lenis-prevent>
        <CommandEmpty>
          {isLoading
            ? "Searching…"
            : debouncedTerm.length >= 2
              ? "No matching cards found."
              : "Type at least 2 characters to search…"}
        </CommandEmpty>

        {/* Search Results */}
        {hits && hits.length > 0 && (
          <CommandGroup heading="Search Results">
            {hits.map((hit) => (
              <CommandItem
                key={hit.slug}
                value={`${hit.title} ${hit.slug}`}
                onSelect={() =>
                  runAndClose(() =>
                    navigate({ to: "/c/$slug", params: { slug: hit.slug } }),
                  )
                }
                className="flex flex-col items-start gap-1 py-2"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{hit.title}</span>
                  <span className="rounded-full bg-surface-sunken px-1.5 py-0.2 font-mono text-2xs text-muted-foreground capitalize">
                    {hit.category}
                  </span>
                </div>
                {hit.snippet && (
                  <p className="line-clamp-1 text-2xs text-muted-foreground">
                    <Snippet text={hit.snippet} />
                  </p>
                )}
              </CommandItem>
            ))}

            <CommandItem
              value={`view all results for ${debouncedTerm}`}
              onSelect={() =>
                runAndClose(() =>
                  navigate({ to: "/search", search: { q: debouncedTerm } }),
                )
              }
              className="text-primary font-medium"
            >
              <HugeiconsIcon icon={Search01Icon} className="size-3.5" />
              <span>View all results on search page</span>
            </CommandItem>
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Navigation Section */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runAndClose(() => navigate({ to: "/" }))}>
            <HugeiconsIcon icon={Layout01Icon} className="size-4" strokeWidth={1.5} />
            <span>Go to Feed</span>
            <CommandShortcut>G F</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runAndClose(() => navigate({ to: "/sources" }))}>
            <HugeiconsIcon icon={Video01Icon} className="size-4" strokeWidth={1.5} />
            <span>Go to Sources</span>
            <CommandShortcut>G S</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runAndClose(() => navigate({ to: "/pending" }))}>
            <HugeiconsIcon icon={Clock01Icon} className="size-4" strokeWidth={1.5} />
            <span>Go to Pending</span>
            <CommandShortcut>G P</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runAndClose(() => navigate({ to: "/rejected" }))}>
            <HugeiconsIcon icon={CancelCircleIcon} className="size-4" strokeWidth={1.5} />
            <span>Go to Rejected</span>
            <CommandShortcut>G R</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runAndClose(() => navigate({ to: "/inventory" }))}>
            <HugeiconsIcon icon={Layers01Icon} className="size-4" strokeWidth={1.5} />
            <span>Go to Inventory</span>
            <CommandShortcut>G I</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runAndClose(() => navigate({ to: "/graph" }))}>
            <HugeiconsIcon icon={GitForkIcon} className="size-4" strokeWidth={1.5} />
            <span>Go to Graph</span>
            <CommandShortcut>G G</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Actions Section */}
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runAndClose(toggleTheme)}>
            <HugeiconsIcon
              icon={resolved === "dark" ? Sun01Icon : Moon02Icon}
              className="size-4"
              strokeWidth={1.5}
            />
            <span>Toggle theme ({resolved === "dark" ? "Light" : "Dark"})</span>
          </CommandItem>

          <CommandItem onSelect={() => runAndClose(handleReindex)}>
            <HugeiconsIcon icon={RefreshIcon} className="size-4" strokeWidth={1.5} />
            <span>Rebuild search index</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
