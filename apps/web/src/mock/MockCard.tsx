import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Cancel01Icon,
  CodeIcon,
  Folder01Icon,
  Link01Icon,
  StarIcon,
  Tag01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { CategoryPill } from "@/components/CategoryPill";

export function MockCard({ onBack, onReject }: { onBack: () => void; onReject: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={onBack}>
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={1.5} />
          Back to feed
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="flex min-w-0 flex-col gap-4">
          <header className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">owner/agent-kit</h1>
            <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-xs font-medium text-muted-foreground">
              <HugeiconsIcon icon={StarIcon} className="size-3 text-warning" strokeWidth={1.5} />
              <span>12.4k</span>
            </span>
          </header>

          <p className="text-sm leading-relaxed">
            <strong>What it is.</strong> A toolkit for building coding agents.
          </p>
          <p className="text-sm leading-relaxed">
            <strong>Why it fills a gap.</strong> Nothing installed covers multi-agent handoff.
          </p>

          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <HugeiconsIcon
              icon={Video01Icon}
              className="size-3.5 text-muted-foreground/80"
              strokeWidth={1.5}
            />
            <span>
              <strong>Origin.</strong> @creator · reel <span className="font-mono">0:23</span>
            </span>
          </p>

          <section className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Notes
            </h2>
            <div className="min-h-24 rounded-lg bg-surface-sunken/60 p-3 font-mono text-xs text-foreground/90 border border-border/40">
              Try it with [[qwen3-8b-gguf]].
            </div>
          </section>

          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onReject}
              className="gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" strokeWidth={1.5} />
              <span>Reject</span>
            </Button>
          </div>
        </article>

        <aside
          aria-label="Properties"
          className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 text-xs shadow-xs"
        >
          <div className="flex flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
              <HugeiconsIcon
                icon={Folder01Icon}
                className="size-3.5 text-muted-foreground/70"
                strokeWidth={1.5}
              />
              Category
            </span>
            <CategoryPill name="repos-tools" color="cat-repos-tools" />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
              <HugeiconsIcon
                icon={CodeIcon}
                className="size-3.5 text-muted-foreground/70"
                strokeWidth={1.5}
              />
              Kind
            </span>
            <span className="font-mono text-xs font-medium">repo</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
              <HugeiconsIcon
                icon={Tag01Icon}
                className="size-3.5 text-muted-foreground/70"
                strokeWidth={1.5}
              />
              Tags
            </span>
            <div className="flex flex-wrap gap-1">
              {["agents", "scraping"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-border/50 bg-muted/60 px-2 py-0.5 font-mono text-2xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
              <HugeiconsIcon
                icon={Link01Icon}
                className="size-3.5 text-muted-foreground/70"
                strokeWidth={1.5}
              />
              Backlinks
            </span>
            <a
              href="#card"
              className="font-mono text-xs text-primary underline-offset-4 hover:underline"
            >
              qwen3-8b-gguf
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
