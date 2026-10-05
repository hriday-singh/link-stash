import { Fragment, useState, type CSSProperties } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowReloadHorizontalIcon,
  CheckmarkBadge01Icon,
  CheckmarkCircle02Icon,
  Comment01Icon,
  CpuIcon,
  PauseIcon,
  PlayIcon,
  ShapesIcon,
  Video01Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { categoryColorVar } from "@/lib/categories";
import type { Category } from "./mock-data";

export function MockSources({ onOpenCard }: { onOpenCard?: (slug: string) => void }) {
  const [activeSource, setActiveSource] = useState("src-1");
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState("0:00");

  const sources = [
    {
      id: "src-1",
      creator: "@agentbuilder",
      title: "How to build modular coding agents without frameworks",
      duration: "0:48",
      cardsCount: 2,
      platform: "Instagram Reel",
      date: "Oct 5, 2026",
      timestamps: [
        { time: "0:12", note: "Architecture diagram" },
        { time: "0:29", note: "Subagent handoff pattern" },
      ],
    },
    {
      id: "src-2",
      creator: "@localllm_dev",
      title: "Running Qwen3 8B GGUF with Ollama on Mac",
      duration: "0:34",
      cardsCount: 1,
      platform: "Instagram Reel",
      date: "Oct 4, 2026",
      timestamps: [{ time: "0:08", note: "Ollama run command" }],
    },
    {
      id: "src-3",
      creator: "@webtools",
      title: "Scrapling: Undetected stealth web scraper in Python",
      duration: "1:02",
      cardsCount: 1,
      platform: "Instagram Reel",
      date: "Oct 2, 2026",
      timestamps: [{ time: "0:18", note: "Fingerprint masking" }],
    },
  ];

  const current = sources.find((s) => s.id === activeSource) ?? sources[0]!;

  const select = (id: string) => {
    setActiveSource(id);
    setPlaying(false);
    setPosition("0:00");
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sources" description="Reels and videos your cards were extracted from." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <header className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-border/70 bg-muted/60 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {current.platform}
              </span>
              <span className="text-xs text-muted-foreground">{current.date}</span>
            </div>
            <h2 className="text-lg font-semibold tracking-tight">{current.title}</h2>
            <p className="text-xs font-medium text-primary">{current.creator}</p>
          </header>

          {/* Mock Video Player */}
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/70 bg-surface-sunken flex flex-col items-center justify-center shadow-xs">
            <div className="flex flex-col items-center gap-3 text-center p-4">
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Pause" : "Play"}
                className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform duration-(--duration-fast) hover:scale-105 active:scale-95"
              >
                <HugeiconsIcon
                  icon={playing ? PauseIcon : PlayIcon}
                  className="size-7"
                  strokeWidth={1.5}
                />
              </button>
              <p className="text-xs font-medium text-muted-foreground">
                Local media source · <span className="font-mono">{current.duration}</span>
              </p>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-border/40 bg-background/80 px-4 py-2 backdrop-blur-xs text-xs">
              <span className="font-mono text-2xs text-muted-foreground">
                {position} / {current.duration}
              </span>
              <div className="flex items-center gap-2">
                {current.timestamps.map((ts) => (
                  <button
                    key={ts.time}
                    type="button"
                    title={ts.note}
                    onClick={() => setPosition(ts.time)}
                    className="rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-2xs text-foreground hover:bg-muted"
                  >
                    {ts.time}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cards extracted from this source */}
          <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Cards Extracted From This Source ({current.cardsCount})
            </h2>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenCard?.("agent-kit")}
                className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-surface-sunken/60 px-3 py-2 text-xs font-medium hover:border-primary/50 transition-colors"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: categoryColorVar("cat-repos-tools") }}
                />
                <span>owner/agent-kit</span>
                <span className="font-mono text-2xs text-muted-foreground">repo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sources List Sidebar */}
        <aside aria-label="Sources List" className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            All Sources ({sources.length})
          </h2>
          <div className="flex flex-col gap-2">
            {sources.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => select(s.id)}
                className={`flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all ${
                  s.id === activeSource
                    ? "border-primary/50 bg-background shadow-pill ring-1 ring-primary/20"
                    : "border-border/60 bg-card/60 hover:bg-card hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between text-2xs text-muted-foreground">
                  <span className="font-medium text-foreground">{s.creator}</span>
                  <span className="font-mono">{s.duration}</span>
                </div>
                <p className="line-clamp-2 text-xs font-medium leading-snug">{s.title}</p>
                <div className="flex items-center gap-1.5 pt-1 text-2xs text-muted-foreground">
                  <HugeiconsIcon icon={Video01Icon} className="size-3" strokeWidth={1.5} />
                  <span>
                    {s.cardsCount} card{s.cardsCount > 1 ? "s" : ""}
                  </span>
                  <span>·</span>
                  <span>{s.date}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function MockPending() {
  const [items, setItems] = useState([
    {
      id: "p-1",
      creator: "@promptengineer",
      instruction: "Comment 'TOOLKIT' on reel for prompt architecture guide",
      date: "Oct 5, 2026",
      status: "Waiting for DM link",
    },
    {
      id: "p-2",
      creator: "@ai_curator",
      instruction: "Comment 'GGUF' on reel for quantization script link",
      date: "Oct 4, 2026",
      status: "Waiting for DM link",
    },
    {
      id: "p-3",
      creator: "@claude_tricks",
      instruction: "Comment 'AGENT' on reel for multi-agent prompt pack",
      date: "Oct 3, 2026",
      status: "Waiting for DM link",
    },
  ]);
  const [inputVals, setInputVals] = useState<Record<string, string>>({});

  const handleResolve = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Pending resolution (${items.length})`}
        description="Reels that need a comment-for-link reply. Paste the link once it arrives."
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            className="size-8 text-success"
            strokeWidth={1.5}
          />
          <p className="text-sm font-medium text-foreground">All pending items resolved!</p>
          <p className="text-xs">Any new reels requiring comment triggers will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-primary">{item.creator}</span>
                <span className="font-mono text-2xs text-muted-foreground">{item.date}</span>
              </div>
              <div className="flex items-start gap-2">
                <HugeiconsIcon
                  icon={Comment01Icon}
                  className="mt-0.5 size-4 shrink-0 text-warning"
                  strokeWidth={1.5}
                />
                <p className="text-xs font-medium leading-relaxed">{item.instruction}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Input
                  placeholder="Paste received DM link (https://...)"
                  value={inputVals[item.id] ?? ""}
                  onChange={(e) => setInputVals({ ...inputVals, [item.id]: e.target.value })}
                  className="h-8 flex-1 min-w-60 text-xs bg-surface-sunken/60"
                />
                <Button
                  size="sm"
                  onClick={() => handleResolve(item.id)}
                  disabled={!inputVals[item.id]?.trim()}
                  className="h-8 px-3 text-xs gap-1.5"
                >
                  <HugeiconsIcon
                    icon={CheckmarkBadge01Icon}
                    className="size-3.5"
                    strokeWidth={1.5}
                  />
                  <span>Resolve & Save</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MockRejected() {
  const [rejects, setRejects] = useState([
    {
      key: "github:langchain-ai/legacy-wrapper",
      title: "legacy-langchain-wrapper",
      reason: "Superceded by native LLM tool calling; unnecessary bloat",
      date: "Oct 2, 2026",
    },
    {
      key: "github:clone-maker/auto-agent-v1",
      title: "auto-agent-v1",
      reason: "Dead repository with unmaintained dependencies",
      date: "Sep 29, 2026",
    },
    {
      key: "url:https://shady-extension.com/dl",
      title: "Unverified Browser AI Extension",
      reason: "Closed source security risk; telemetry concerns",
      date: "Sep 24, 2026",
    },
  ]);

  const handleUnreject = (key: string) => {
    setRejects((prev) => prev.filter((r) => r.key !== key));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Rejected log (${rejects.length})`}
        description="Rejected links are skipped during triage and never suggested again."
      />

      {rejects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <p className="text-sm font-medium text-foreground">No rejected items.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rejects.map((r) => (
            <div
              key={r.key}
              className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-xs"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-xs truncate">{r.title}</h3>
                  <span className="font-mono text-2xs text-muted-foreground">{r.date}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-normal">{r.reason}</p>
                <span className="font-mono text-2xs text-muted-foreground/60 truncate">
                  {r.key}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUnreject(r.key)}
                className="gap-1.5 shrink-0 text-xs h-8"
              >
                <HugeiconsIcon
                  icon={ArrowReloadHorizontalIcon}
                  className="size-3.5"
                  strokeWidth={1.5}
                />
                <span>Un-reject</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MockInventory() {
  const sections = [
    {
      title: "Local Models",
      icon: CpuIcon,
      items: [
        {
          name: "qwen2.5-coder:7b",
          provider: "Ollama",
          status: "Installed",
          note: "Primary coding engine",
        },
        {
          name: "deepseek-r1:8b",
          provider: "Ollama",
          status: "Installed",
          note: "Reasoning & plan check",
        },
        {
          name: "llama3.2:3b",
          provider: "Ollama",
          status: "Installed",
          note: "Lightweight extractor",
        },
      ],
    },
    {
      title: "Coding Tools & CLI",
      icon: Wrench01Icon,
      items: [
        {
          name: "Claude Code",
          provider: "Anthropic",
          status: "Active",
          note: "CLI agent workflow",
        },
        {
          name: "Antigravity CLI",
          provider: "Google DeepMind",
          status: "Active",
          note: "Autonomous runner",
        },
      ],
    },
    {
      title: "MCP Servers",
      icon: ShapesIcon,
      items: [
        {
          name: "scrapling",
          provider: "Local Python",
          status: "Connected",
          note: "Fast stealth fetch",
        },
        {
          name: "context7",
          provider: "Cloud Gateway",
          status: "Connected",
          note: "Documentation lookups",
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="System inventory"
        description="What you already have installed. New finds are checked against it."
      />

      <div className="flex flex-col gap-6">
        {sections.map((sec) => (
          <section key={sec.title} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={sec.icon} className="size-4 text-primary" strokeWidth={1.5} />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {sec.title} ({sec.items.length})
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sec.items.map((it) => (
                <div
                  key={it.name}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-xs"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold">{it.name}</span>
                      <span className="shrink-0 rounded-full border border-success/20 bg-success/10 px-1.5 py-0.5 font-mono text-2xs font-medium text-success">
                        {it.status}
                      </span>
                    </div>
                    <span className="font-mono text-2xs text-muted-foreground">{it.provider}</span>
                  </div>
                  <p className="text-2xs text-muted-foreground/80">{it.note}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

const GRAPH_NODES = [
  { id: "agent-kit", label: "agent-kit", short: "AK", color: "cat-repos-tools", size: "size-12" },
  { id: "qwen3-8b-gguf", label: "qwen3-8b", short: "QW", color: "cat-models", size: "size-10" },
  { id: null, label: "@agentbuilder", short: "@ab", color: "cat-skills-plugins", size: "size-9" },
] as const;

export function MockGraph({
  categories,
  onOpenCard,
}: {
  categories: readonly Category[];
  onOpenCard: (slug: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Global knowledge graph"
        description="48 nodes · 84 edges across cards, sources and creators"
      />

      <div className="relative flex min-h-96 w-full flex-col items-center justify-center overflow-hidden rounded-xl border bg-surface-sunken shadow-xs sm:aspect-video">
        <div className="absolute top-4 left-4 flex max-w-[calc(100%-2rem)] flex-wrap gap-x-3 gap-y-1.5 rounded-lg border bg-background/80 p-2.5 backdrop-blur-xs">
          {categories.map((c) => (
            <div key={c.name} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: categoryColorVar(c.color) }}
              />
              <span className="text-2xs text-muted-foreground">{c.name}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-4 p-6 pt-24 text-center sm:pt-6">
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            {GRAPH_NODES.map((n, i) => {
              const dot = (
                <span
                  className={`${n.size} tile-tint flex items-center justify-center rounded-full border-2 text-xs font-bold shadow-md`}
                  style={
                    {
                      "--tint": categoryColorVar(n.color),
                      borderColor: categoryColorVar(n.color),
                    } as CSSProperties
                  }
                >
                  {n.short}
                </span>
              );
              return (
                <Fragment key={n.label}>
                  {i > 0 && <span aria-hidden className="h-0.5 w-8 bg-border sm:w-12" />}
                  {n.id ? (
                    <button
                      type="button"
                      onClick={() => onOpenCard(n.id)}
                      className="group flex flex-col items-center gap-1.5 rounded-md transition-transform duration-(--duration-fast) hover:scale-110"
                    >
                      {dot}
                      <span className="font-mono text-2xs text-muted-foreground group-hover:text-foreground">
                        {n.label}
                      </span>
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      {dot}
                      <span className="font-mono text-2xs text-muted-foreground">{n.label}</span>
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
          <p className="max-w-sm text-xs text-muted-foreground">
            Preview of the relationship graph. Click a card node to open it.
          </p>
        </div>
      </div>
    </div>
  );
}
