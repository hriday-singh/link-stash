import type { TileData } from "@/components/Tile";

export const MOCK_CATEGORIES = [
  { name: "models", color: "cat-models", count: 12 },
  { name: "skills-plugins", color: "cat-skills-plugins", count: 31 },
  { name: "mcp-servers", color: "cat-mcp-servers", count: 9 },
  { name: "repos-tools", color: "cat-repos-tools", count: 44 },
  { name: "ui-ux", color: "cat-ui-ux", count: 17 },
  { name: "practices", color: "cat-practices", count: 8 },
];

const t = (
  slug: string,
  title: string,
  category: string,
  kind: TileData["kind"],
  key: string,
): TileData => ({
  slug,
  key,
  title,
  category,
  categoryColor: `cat-${category}`,
  kind,
  thumbUrl: null,
  platform: "instagram",
});

export const MOCK_DAYS: { label: string; tiles: TileData[] }[] = [
  {
    label: "Today",
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
    tiles: [
      t("scrapling", "Scrapling", "mcp-servers", "mcp", "github:d4vinci/scrapling"),
      t("gh-secure", "gh-secure", "skills-plugins", "skill", "github:github/gh-secure"),
    ],
  },
];
