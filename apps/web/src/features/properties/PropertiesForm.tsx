import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { LinkSquare02Icon } from "@hugeicons/core-free-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChipInput } from "@/components/ui/chip-input";
import { KIND_ICON, type Kind } from "@/lib/kinds";
import { categoryColorVar } from "@/lib/categories";
import type { CardDetail } from "@/api/client";

export interface PropertiesFormProps {
  card: CardDetail["card"];
  categories?: Array<{ name: string; color: string }>;
  suggestedTags?: string[];
  onSaveField: (patch: { category?: string; kind?: Kind; tags?: string[] }) => Promise<void> | void;
  fieldErrors?: Record<string, string>;
  disabled?: boolean;
  className?: string;
}

const ALL_KINDS: Kind[] = [
  "repo",
  "model",
  "skill",
  "plugin",
  "mcp",
  "tool",
  "ui_ref",
  "practice",
  "link",
];

export function PropertiesForm({
  card,
  categories = [],
  suggestedTags = [],
  onSaveField,
  fieldErrors = {},
  disabled = false,
  className = "",
}: PropertiesFormProps) {
  const handleCategoryChange = (val: string) => {
    void onSaveField({ category: val });
  };

  const handleKindChange = (val: string) => {
    const k = val as Kind;
    void onSaveField({ kind: k });
  };

  const handleTagsChange = (tags: string[]) => {
    void onSaveField({ tags });
  };

  return (
    <div className={`space-y-6 text-xs text-foreground/90 ${className}`}>
      {/* Category */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Category
        </label>
        <Select
          value={card.category}
          onValueChange={handleCategoryChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.name} value={cat.name}>
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: categoryColorVar(cat.color) }}
                  />
                  <span>{cat.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.category && (
          <p className="text-[11px] text-destructive">{fieldErrors.category}</p>
        )}
      </div>

      {/* Kind */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Kind
        </label>
        <Select
          value={card.kind}
          onValueChange={handleKindChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select kind" />
          </SelectTrigger>
          <SelectContent>
            {ALL_KINDS.map((k) => {
              const Icon = KIND_ICON[k];
              return (
                <SelectItem key={k} value={k}>
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={Icon} className="size-3.5 text-muted-foreground" />
                    <span className="capitalize">{k}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {fieldErrors.kind && (
          <p className="text-[11px] text-destructive">{fieldErrors.kind}</p>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Tags
        </label>
        <ChipInput
          value={card.tags || []}
          onChange={handleTagsChange}
          suggestions={suggestedTags}
          disabled={disabled}
          placeholder="Add tag…"
        />
        {fieldErrors.tags && (
          <p className="text-[11px] text-destructive">{fieldErrors.tags}</p>
        )}
      </div>

      <div className="border-t border-border/60 pt-4 space-y-4">
        {/* Key */}
        <div className="space-y-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Key
          </span>
          <p className="font-mono text-xs text-foreground/80 break-all select-all">
            {card.key}
          </p>
        </div>

        {/* URL */}
        {card.url && (
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              URL
            </span>
            <div className="flex items-center gap-1.5">
              <a
                href={card.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary hover:underline"
              >
                {card.url}
              </a>
              <HugeiconsIcon icon={LinkSquare02Icon} className="size-3 text-muted-foreground shrink-0" />
            </div>
          </div>
        )}

        {/* Overlaps */}
        {card.overlaps && card.overlaps.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Overlaps
            </span>
            <ul className="space-y-1">
              {card.overlaps.map((overlap) => (
                <li key={overlap} className="text-xs">
                  <Link
                    to="/c/$slug"
                    params={{ slug: overlap }}
                    className="text-primary hover:underline"
                  >
                    {overlap}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sources */}
        {card.sources && card.sources.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Sources
            </span>
            <ul className="space-y-1">
              {card.sources.map((sourceId) => (
                <li key={sourceId} className="text-xs">
                  <Link
                    to="/s/$sourceId"
                    params={{ sourceId }}
                    className="text-primary hover:underline"
                  >
                    {sourceId}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Added */}
        {card.added && (
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Added
            </span>
            <p className="text-muted-foreground text-xs">{card.added}</p>
          </div>
        )}

        {/* Facts */}
        {card.facts && Object.keys(card.facts).length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Facts
            </span>
            <div className="rounded-md border border-border/60 bg-muted/30 p-2 space-y-1">
              {Object.entries(card.facts).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 text-[11px]">
                  <span className="text-muted-foreground capitalize">{k}:</span>
                  <span className="font-mono text-foreground">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Features */}
        {card.features && card.features.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Features
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-foreground/80 pl-1">
              {card.features.map((feat, i) => (
                <li key={i}>{feat}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
