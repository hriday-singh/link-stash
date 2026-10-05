import { useState, type FormEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { categoryColorVar, categoryNameError } from "@/lib/categories";

const COLORS = Array.from({ length: 8 }, (_, i) => `cat-extra-${i + 1}`);

export function AddCategoryDialog({
  existing,
  onAdd,
}: {
  existing: readonly string[];
  onAdd: (category: { name: string; color: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]!);
  const [touched, setTouched] = useState(false);
  const error = categoryNameError(name.trim(), existing);

  const reset = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setName("");
      setColor(COLORS[0]!);
      setTouched(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (error) return;
    onAdd({ name: name.trim(), color });
    reset(false);
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label="Add category">
          <HugeiconsIcon icon={Add01Icon} strokeWidth={1.5} />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
            <DialogDescription>Cards can be filed under it during triage.</DialogDescription>
          </DialogHeader>

          <label className="flex flex-col gap-1.5 text-xs font-medium">
            Name
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase())}
              placeholder="e.g. prompts"
              aria-invalid={touched && error !== null}
              aria-describedby="category-name-error"
            />
            {touched && error && (
              <span id="category-name-error" className="font-normal text-destructive">
                {error}
              </span>
            )}
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="pb-1.5 text-xs font-medium">Color</legend>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${i + 1}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-7 rounded-full ring-offset-2 ring-offset-popover transition-transform duration-(--duration-fast) hover:scale-110",
                    color === c && "ring-2 ring-ring",
                  )}
                  style={{ background: categoryColorVar(c) }}
                />
              ))}
            </div>
          </fieldset>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Create category</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
