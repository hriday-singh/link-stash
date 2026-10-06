import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeGitRepo } from "./lib/git-analyzer.mjs";
import { generateHtmlDashboard } from "./lib/html-template.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputPath = path.join(repoRoot, "stats.html");

try {
  console.log("Analyzing git repository...");
  const stats = analyzeGitRepo(repoRoot);

  console.log(`- Total commits: ${stats.summary.totalCommits}`);
  console.log(`- Tracked files: ${stats.summary.totalFiles}`);
  console.log(`- Net lines of code: ${stats.summary.netLines.toLocaleString()} (+${stats.summary.totalAdditions.toLocaleString()} / -${stats.summary.totalDeletions.toLocaleString()})`);
  console.log(`- Active file lines: ${stats.summary.totalTrackedLines.toLocaleString()}`);

  const html = generateHtmlDashboard(stats);
  fs.writeFileSync(outputPath, html, "utf-8");

  console.log(`\nRepository stats dashboard generated successfully at:`);
  console.log(`file:///${outputPath.replace(/\\/g, "/")}`);
} catch (error) {
  console.error("Failed to generate repository stats dashboard:", error);
  process.exit(1);
}
