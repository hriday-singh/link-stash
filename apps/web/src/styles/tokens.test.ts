import { readFileSync } from "node:fs";
import path from "node:path";
import { wcagContrast } from "culori";
import { SEED_CATEGORIES } from "@/lib/categories";

const cssPath = path.resolve(process.cwd(), "src/styles/tokens.css");
const css = readFileSync(cssPath, "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block in tokens.css`);
  const body = css.slice(start, css.indexOf("\n}", start + 1));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[m[1]!] = m[2]!.trim();
  return vars;
}

function resolve(vars: Record<string, string>, name: string, fallback: Record<string, string>) {
  let value = vars[name] ?? fallback[name];
  while (value?.startsWith("var(--")) {
    const ref = value.slice(6, -1);
    value = vars[ref] ?? fallback[ref];
  }
  if (!value) throw new Error(`--${name} is not defined`);
  return value;
}

const light = block(":root");
const dark = block(".dark");
const CATEGORY_TOKENS = [
  ...SEED_CATEGORIES.map((c) => `cat-${c}`),
  ...Array.from({ length: 8 }, (_, i) => `cat-extra-${i + 1}`),
];
const TEXT_PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["primary-foreground", "primary"],
  ["destructive-foreground", "destructive"],
  ["primary", "background"],
  ["destructive", "background"],
  ["success", "background"],
  ["warning", "background"],
];

describe.each([
  ["light", light, {}],
  ["dark", dark, light],
] as const)("%s theme", (_name, vars, fallback) => {
  it.each(TEXT_PAIRS)("%s on %s meets WCAG AA", (fg, bg) => {
    const ratio = wcagContrast(resolve(vars, fg, fallback), resolve(vars, bg, fallback));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("defines every category token", () => {
    for (const token of CATEGORY_TOKENS) expect(resolve(vars, token, fallback)).toMatch(/^oklch\(/);
  });
});
