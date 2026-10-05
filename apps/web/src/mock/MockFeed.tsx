import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tile } from "@/components/Tile";
import { categoryColorVar } from "@/lib/categories";
import { MOCK_CATEGORIES, MOCK_DAYS } from "./mock-data";

export function MockSidebar() {
  return (
    <nav
      aria-label="Library"
      className="hidden w-60 shrink-0 flex-col gap-1 border-r bg-muted/40 p-3 lg:flex"
    >
      {["Feed", "Sources", "Pending (3)", "Rejected", "Inventory", "Graph"].map((label) => (
        <a key={label} href="#" className="rounded-md px-2 py-1.5 text-sm hover:bg-accent">
          {label}
        </a>
      ))}
      <Separator className="my-2" />
      {MOCK_CATEGORIES.map((c) => (
        <a
          key={c.name}
          href="#"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
        >
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ background: categoryColorVar(c.color) }}
          />
          <span className="flex-1 truncate">{c.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{c.count}</span>
        </a>
      ))}
    </nav>
  );
}

export function MockFeed() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex items-center gap-2">
        <Input placeholder="Search  Ctrl+K" className="max-w-md" />
      </div>
      {MOCK_DAYS.map((day) => (
        <section key={day.label} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">{day.label}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {day.tiles.map((tile) => (
              <Tile key={tile.slug} data={tile} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
