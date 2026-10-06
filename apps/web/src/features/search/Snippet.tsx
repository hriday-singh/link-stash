import { type ReactNode } from "react";

export interface SnippetProps {
  text: string;
  className?: string;
}

/**
 * Renders an SQLite FTS5 snippet safely as React nodes,
 * transforming ASCII \x02 (start) and \x03 (end) markers into styled <mark> elements.
 * Never uses dangerouslySetInnerHTML.
 */
export function Snippet({ text, className }: SnippetProps) {
  if (!text) return null;

  const parts: ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    const startIdx = remaining.indexOf("\x02");
    if (startIdx === -1) {
      // No more markers
      parts.push(remaining);
      break;
    }

    if (startIdx > 0) {
      parts.push(remaining.slice(0, startIdx));
    }

    const endIdx = remaining.indexOf("\x03", startIdx + 1);
    if (endIdx === -1) {
      // Unclosed marker, render rest as mark
      parts.push(
        <mark
          key={`mark-${keyIndex}`}
          className="rounded-xs bg-primary/20 px-0.5 font-medium text-foreground"
        >
          {remaining.slice(startIdx + 1)}
        </mark>,
      );
      break;
    }

    const highlighted = remaining.slice(startIdx + 1, endIdx);
    parts.push(
      <mark
        key={`mark-${keyIndex++}`}
        className="rounded-xs bg-primary/20 px-0.5 font-medium text-foreground"
      >
        {highlighted}
      </mark>,
    );

    remaining = remaining.slice(endIdx + 1);
  }

  return <span className={className}>{parts}</span>;
}
