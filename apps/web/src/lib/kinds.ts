import {
  AiBrain01Icon,
  CodeIcon,
  Idea01Icon,
  Link01Icon,
  PaintBoardIcon,
  PlugSocketIcon,
  PuzzleIcon,
  ServerStack01Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";

export const KIND_ICON = {
  repo: CodeIcon,
  model: AiBrain01Icon,
  skill: PuzzleIcon,
  plugin: PlugSocketIcon,
  mcp: ServerStack01Icon,
  tool: Wrench01Icon,
  ui_ref: PaintBoardIcon,
  practice: Idea01Icon,
  link: Link01Icon,
} as const;

export type Kind = keyof typeof KIND_ICON;

function firstWords(text: string, n: number): string {
  const words = text.trim().split(/\s+/);
  return words.length > n ? `${words.slice(0, n).join(" ")}…` : words.join(" ");
}

/** Big label + small label for a tile with no thumbnail. Unknown key shapes fall back to the title. */
export function generatedLabel(key: string, title: string): [string, string | null] {
  if (key.startsWith("practice:")) return [firstWords(title, 6), null];
  if (key.startsWith("url:") || key.startsWith("ollama:")) return [title, null];
  const id = key.slice(key.indexOf(":", key.startsWith("hf:") ? 3 : 0) + 1);
  const slash = id.lastIndexOf("/");
  if (slash > 0 && slash < id.length - 1) return [id.slice(slash + 1), id.slice(0, slash)];
  return [title, null];
}
