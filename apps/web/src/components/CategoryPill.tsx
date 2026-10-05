import { categoryColorVar } from "@/lib/categories";

export function CategoryPill({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex w-fit max-w-full items-center gap-1.5 truncate rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ background: categoryColorVar(color) }}
      />
      {name}
    </span>
  );
}
