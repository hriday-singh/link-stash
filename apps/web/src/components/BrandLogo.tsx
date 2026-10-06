import * as React from "react";

import instagramSvg from "@/assets/brands/instagram.svg";
import githubSvg from "@/assets/brands/github.svg";
import huggingfaceSvg from "@/assets/brands/huggingface.svg";
import notionSvg from "@/assets/brands/notion.svg";
import ollamaSvg from "@/assets/brands/ollama.svg";
import lmstudioSvg from "@/assets/brands/lmstudio.svg";
import claudeSvg from "@/assets/brands/claude.svg";
import geminiSvg from "@/assets/brands/gemini.svg";
import antigravitySvg from "@/assets/brands/antigravity.svg";
import codexSvg from "@/assets/brands/codex.svg";
import qwenSvg from "@/assets/brands/qwen.svg";

export type BrandId =
  | "instagram"
  | "github"
  | "huggingface"
  | "notion"
  | "ollama"
  | "lmstudio"
  | "claude"
  | "gemini"
  | "antigravity"
  | "codex"
  | "qwen";

export interface BrandInfo {
  id: BrandId;
  name: string;
}

const BRAND_DEFINITIONS: Record<BrandId, BrandInfo> = {
  instagram: { id: "instagram", name: "Instagram" },
  github: { id: "github", name: "GitHub" },
  huggingface: { id: "huggingface", name: "Hugging Face" },
  notion: { id: "notion", name: "Notion" },
  ollama: { id: "ollama", name: "Ollama" },
  lmstudio: { id: "lmstudio", name: "LM Studio" },
  claude: { id: "claude", name: "Claude" },
  gemini: { id: "gemini", name: "Gemini" },
  antigravity: { id: "antigravity", name: "Antigravity" },
  codex: { id: "codex", name: "Codex" },
  qwen: { id: "qwen", name: "Qwen" },
};

const BRAND_ASSETS: Record<BrandId, string> = {
  instagram: instagramSvg,
  github: githubSvg,
  huggingface: huggingfaceSvg,
  notion: notionSvg,
  ollama: ollamaSvg,
  lmstudio: lmstudioSvg,
  claude: claudeSvg,
  gemini: geminiSvg,
  antigravity: antigravitySvg,
  codex: codexSvg,
  qwen: qwenSvg,
};

/**
 * Resolves a platform, tool, or scanner identifier into a canonical BrandInfo,
 * or returns null if no known brand matches.
 */
export function brandFor(platformOrTool: string | null | undefined): BrandInfo | null {
  if (!platformOrTool) return null;
  const raw = platformOrTool.trim().toLowerCase();
  if (!raw) return null;

  // Strip prefixes like "github:", "ig:", "instagram:", "hf:", etc.
  const name = raw.includes(":") ? raw.split(":")[0]?.trim() || raw : raw;

  if (name === "instagram" || name === "ig" || raw.includes("instagram")) {
    return BRAND_DEFINITIONS.instagram;
  }
  if (name === "github" || name === "gh" || raw.includes("github")) {
    return BRAND_DEFINITIONS.github;
  }
  if (
    name === "huggingface" ||
    name === "hf" ||
    raw.includes("huggingface") ||
    raw.includes("hugging face")
  ) {
    return BRAND_DEFINITIONS.huggingface;
  }
  if (name === "notion" || raw.includes("notion")) {
    return BRAND_DEFINITIONS.notion;
  }
  if (name === "ollama" || raw.includes("ollama")) {
    return BRAND_DEFINITIONS.ollama;
  }
  if (
    name === "lmstudio" ||
    name === "lm-studio" ||
    name === "lm studio" ||
    raw.includes("lmstudio") ||
    raw.includes("lm studio")
  ) {
    return BRAND_DEFINITIONS.lmstudio;
  }
  if (name === "claude" || name === "anthropic" || raw.includes("claude")) {
    return BRAND_DEFINITIONS.claude;
  }
  if (name === "gemini" || name === "google" || raw.includes("gemini")) {
    return BRAND_DEFINITIONS.gemini;
  }
  if (
    name === "antigravity" ||
    name === "agy" ||
    name === "deepmind" ||
    raw.includes("antigravity")
  ) {
    return BRAND_DEFINITIONS.antigravity;
  }
  if (name === "codex" || raw.includes("codex")) {
    return BRAND_DEFINITIONS.codex;
  }
  if (name === "qwen" || raw.includes("qwen")) {
    return BRAND_DEFINITIONS.qwen;
  }

  return null;
}

export interface BrandLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  brand: string | null | undefined;
  size?: number | string;
  className?: string;
}

/**
 * Renders the official brand SVG logo sourced from thesvg.org,
 * with accessible alt text and lazy loading.
 */
export function BrandLogo({ brand, size = 16, className = "", style, ...props }: BrandLogoProps) {
  const info = brandFor(brand);
  if (!info) return null;

  const src = BRAND_ASSETS[info.id];
  if (!src) return null;

  return (
    <img
      src={src}
      alt={info.name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={{ width: size, height: size, ...style }}
      className={`inline-block shrink-0 object-contain ${className}`.trim()}
      {...props}
    />
  );
}
