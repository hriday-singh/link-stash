import { Button } from "@/components/ui/button";
import { CategoryPill } from "@/components/CategoryPill";

export function MockCard() {
  return (
    <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:p-6">
      <article className="flex min-w-0 flex-col gap-4">
        <header className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-2xl font-semibold">owner/agent-kit</h1>
          <span className="font-mono text-xs text-muted-foreground">★ 12.4k</span>
        </header>
        <p>
          <strong>What it is.</strong> A toolkit for building coding agents.
        </p>
        <p>
          <strong>Why it fills a gap.</strong> Nothing installed covers multi-agent handoff.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>Origin.</strong> @creator · reel <span className="font-mono">0:23</span>
        </p>
        <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
          <h2 className="text-sm font-medium">Notes</h2>
          <div className="min-h-24 rounded-md bg-muted/50 p-2 font-mono text-sm">
            Try it with [[qwen3-8b-gguf]].
          </div>
        </section>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm">
            ⋯ Reject
          </Button>
        </div>
      </article>
      <aside
        aria-label="Properties"
        className="flex flex-col gap-4 rounded-lg border bg-card p-4 text-sm"
      >
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground">Category</span>
          <CategoryPill name="repos-tools" color="cat-repos-tools" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground">Kind</span>
          <span>repo</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground">Tags</span>
          <div className="flex flex-wrap gap-1">
            {["agents", "scraping"].map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground">Backlinks</span>
          <a href="#" className="text-primary underline-offset-4 hover:underline">
            qwen3-8b-gguf
          </a>
        </div>
      </aside>
    </div>
  );
}
