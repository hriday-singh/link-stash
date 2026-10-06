import type { InventoryEntry } from "@/api/client";

export interface InventoryGroup {
  id: string;
  title: string;
  isAuto: boolean;
  brand?: string;
  items: InventoryEntry[];
}

/**
 * Formats origin string into display title, isAuto flag, and optional brand logo ID.
 */
export function formatOriginTitle(origin: string): {
  title: string;
  isAuto: boolean;
  brand?: string;
} {
  const norm = origin.trim().toLowerCase();

  if (norm.startsWith("inventory/manual/") || norm.includes("manual")) {
    const filename = norm.split("/").pop() || norm;
    const cleanName = filename.replace(".md", "");
    const capName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    return {
      title: `Manual: ${capName}`,
      isAuto: false,
    };
  }

  // Auto scanners: e.g. "claude", "antigravity", "codex", "ollama", "lmstudio", "tools", "qwen"
  if (norm === "agy" || norm === "antigravity") {
    return { title: "Antigravity", isAuto: true, brand: "antigravity" };
  }
  if (norm === "claude" || norm === "anthropic") {
    return { title: "Claude Code", isAuto: true, brand: "claude" };
  }
  if (norm === "codex") {
    return { title: "Codex", isAuto: true, brand: "codex" };
  }
  if (norm === "ollama") {
    return { title: "Ollama Models", isAuto: true, brand: "ollama" };
  }
  if (norm === "lmstudio" || norm === "lm-studio" || norm === "lm studio") {
    return { title: "LM Studio", isAuto: true, brand: "lmstudio" };
  }
  if (norm === "qwen") {
    return { title: "Qwen", isAuto: true, brand: "qwen" };
  }
  if (norm === "huggingface" || norm === "hf") {
    return { title: "Hugging Face Cache", isAuto: true, brand: "huggingface" };
  }
  if (norm === "tools") {
    return { title: "System Tools & PATH", isAuto: true };
  }

  const cap = norm.charAt(0).toUpperCase() + norm.slice(1);
  return {
    title: cap,
    isAuto: true,
    brand: norm,
  };
}

/**
 * Groups inventory entries by origin.
 * Automatically separates auto host scanner groups and manual file inventories.
 * Tested to handle hundreds of entries efficiently.
 */
export function groupByOrigin(items: InventoryEntry[]): InventoryGroup[] {
  const groupsMap = new Map<string, InventoryGroup>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const origin = item.origin || "unknown";

    let group = groupsMap.get(origin);
    if (!group) {
      const meta = formatOriginTitle(origin);
      group = {
        id: origin,
        title: meta.title,
        isAuto: meta.isAuto,
        brand: meta.brand,
        items: [],
      };
      groupsMap.set(origin, group);
    }
    group.items.push(item);
  }

  // Sort groups: Auto groups first, then Manual groups, alphabetically
  return Array.from(groupsMap.values()).sort((a, b) => {
    if (a.isAuto !== b.isAuto) {
      return a.isAuto ? -1 : 1;
    }
    return a.title.localeCompare(b.title);
  });
}
