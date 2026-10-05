import type { TileData } from "@/components/Tile";
import type { FeedDay } from "@/lib/feed-filter";

export interface Category {
  name: string;
  color: string;
  count: number;
}

export const MOCK_CATEGORIES: Category[] = [
  { name: "models", color: "cat-models", count: 12 },
  { name: "skills-plugins", color: "cat-skills-plugins", count: 31 },
  { name: "mcp-servers", color: "cat-mcp-servers", count: 9 },
  { name: "repos-tools", color: "cat-repos-tools", count: 44 },
  { name: "ui-ux", color: "cat-ui-ux", count: 17 },
  { name: "practices", color: "cat-practices", count: 8 },
];

export const MOCK_PLATFORMS = ["instagram", "youtube"] as const;

const t = (
  slug: string,
  title: string,
  category: string,
  kind: TileData["kind"],
  key: string,
  platform: string = "instagram",
): TileData => ({
  slug,
  key,
  title,
  category,
  categoryColor: `cat-${category}`,
  kind,
  thumbUrl: null,
  platform,
});

export const MOCK_DAYS: FeedDay[] = [
  {
    label: "Today",
    ageDays: 0,
    tiles: [
      t("agent-kit", "Agent Kit", "repos-tools", "repo", "github:owner/agent-kit"),
      t("qwen3-8b-gguf", "Qwen3 8B GGUF", "models", "model", "hf:model:qwen/qwen3-8b-gguf"),
      t(
        "plan-first",
        "Plan mode before multi-file edits, every single time you touch more than one file",
        "practices",
        "practice",
        "practice:plan-first",
      ),
      t("shadcn-ui", "shadcn/ui", "ui-ux", "ui_ref", "github:shadcn-ui/ui"),
    ],
  },
  {
    label: "Yesterday",
    ageDays: 1,
    tiles: [
      t("scrapling", "Scrapling", "mcp-servers", "mcp", "github:d4vinci/scrapling"),
      t("gh-secure", "gh-secure", "skills-plugins", "skill", "github:github/gh-secure"),
    ],
  },
  {
    label: "Last week",
    ageDays: 6,
    tiles: [
      t(
        "context7",
        "Context7 docs server",
        "mcp-servers",
        "mcp",
        "github:upstash/context7",
        "youtube",
      ),
      t("llama-3-2-3b", "Llama 3.2 3B", "models", "model", "ollama:llama3.2:3b", "youtube"),
      t("radix-ui", "Radix Primitives", "ui-ux", "ui_ref", "github:radix-ui/primitives"),
    ],
  },
];
