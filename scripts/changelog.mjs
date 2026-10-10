// Prints CHANGELOG sections added since the last `pnpm setup`, then records the current version.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const SEEN = ".stash-version";
const current = readFileSync("apps/core/pyproject.toml", "utf8").match(/^version = "(.+)"/m)[1];
const last = existsSync(SEEN) ? readFileSync(SEEN, "utf8").trim() : null;

if (last === current) {
  console.log(`\nstash ${current} (no changes since last setup)`);
} else {
  // Sections are newest-first; show everything above the last-seen version.
  const sections = readFileSync("CHANGELOG.md", "utf8").split(/^(?=## \[)/m).slice(1);
  const lastIdx = sections.findIndex((s) => s.startsWith(`## [${last}]`));
  const fresh = last && lastIdx !== -1 ? sections.slice(0, lastIdx) : sections.slice(0, 1);
  console.log(`\nstash ${last ?? "(new install)"} -> ${current}\n`);
  console.log(fresh.join("").trim());
  writeFileSync(SEEN, current + "\n");
}
