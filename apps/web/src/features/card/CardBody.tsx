import { useMemo } from "react";
import Markdown from "react-markdown";
import { Link } from "@tanstack/react-router";
import { isSafeUrl, preprocessWikilinks } from "./wikilinks";

export interface CardBodyProps {
  body: string;
  resolved?: Record<string, string>;
  className?: string;
}

export function CardBody({ body, resolved = {}, className = "" }: CardBodyProps) {
  const processed = useMemo(() => preprocessWikilinks(body, resolved), [body, resolved]);

  return (
    <div className={`space-y-4 text-foreground/90 ${className}`}>
      <Markdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-semibold tracking-tight text-foreground mt-6 mb-2 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold tracking-tight text-foreground mt-5 mb-2 border-b border-border/50 pb-1.5 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold tracking-tight text-foreground mt-4 mb-1">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-foreground/90 mb-3 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 text-sm text-foreground/90 mb-3 pl-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 text-sm text-foreground/90 mb-3 pl-1">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-3.5 my-3 italic text-muted-foreground text-sm">
              {children}
            </blockquote>
          ),
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.includes("language-");
            if (isBlock) {
              return (
                <code className={`block font-mono text-xs text-foreground ${codeClassName}`}>
                  {children}
                </code>
              );
            }
            return (
              <code className="font-mono text-xs bg-muted text-foreground px-1.5 py-0.5 rounded border border-border/50">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="p-3 rounded-lg bg-muted/70 border border-border overflow-x-auto my-3 font-mono text-xs">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-6 border-border/60" />,
          a: ({ href, children }) => {
            if (href?.startsWith("/c/")) {
              const slug = href.slice(3);
              return (
                <Link
                  to="/c/$slug"
                  params={{ slug }}
                  className="font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary transition-colors"
                >
                  {children}
                </Link>
              );
            }

            if (href?.startsWith("#stash-unresolved:")) {
              const slug = href.slice("#stash-unresolved:".length);
              return (
                <span
                  data-testid="unresolved-wikilink"
                  className="inline-flex items-center text-muted-foreground line-through opacity-75 font-mono text-xs px-1.5 py-0.5 rounded bg-muted border border-border/40 select-none"
                  title={`Unresolved link: [[${slug}]]`}
                >
                  [[{children || slug}]]
                </span>
              );
            }

            if (!isSafeUrl(href)) {
              return <span className="text-muted-foreground line-through">{children}</span>;
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary transition-colors"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {processed}
      </Markdown>
    </div>
  );
}
