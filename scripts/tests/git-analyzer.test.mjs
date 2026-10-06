import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { analyzeGitRepo } from "../lib/git-analyzer.mjs";
import { generateHtmlDashboard } from "../lib/html-template.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

test("analyzeGitRepo parses valid repository statistics", () => {
  const stats = analyzeGitRepo(repoRoot);

  assert.ok(stats.summary, "summary exists");
  assert.ok(stats.summary.totalCommits >= 18, "commits parsed accurately");
  assert.ok(stats.summary.totalFiles > 0, "tracked files count is positive");
  assert.ok(stats.summary.netLines > 0, "net lines is positive");
  assert.ok(stats.summary.totalAdditions > 0, "total additions is positive");
  assert.ok(Array.isArray(stats.commits), "commits is an array");
  assert.ok(Array.isArray(stats.extensions), "extensions is an array");
  assert.ok(Array.isArray(stats.summary.commitTypes), "commit types is an array");

  // Validate commit object structure
  const first = stats.commits[0];
  assert.ok(first.hash, "commit has full hash");
  assert.ok(first.shortHash, "commit has short hash");
  assert.ok(first.date, "commit has date");
  assert.ok(typeof first.net === "number", "commit net is a number");
  assert.ok(typeof first.cumulativeNet === "number", "cumulativeNet is a number");
});

test("generateHtmlDashboard returns complete HTML document containing valid payload", () => {
  const mockStats = {
    summary: {
      totalCommits: 5,
      totalFiles: 20,
      totalTrackedLines: 1500,
      totalAdditions: 2000,
      totalDeletions: 500,
      netLines: 1500,
      avgInsertionsPerCommit: 400,
      avgDeletionsPerCommit: 100,
      avgFilesPerCommit: "4.0",
      firstCommitDate: "2026-10-01",
      latestCommitDate: "2026-10-05",
      authors: [{ author: "Dev", commits: 5, insertions: 2000, deletions: 500, net: 1500 }],
      commitTypes: [{ type: "feat", count: 4 }, { type: "fix", count: 1 }],
    },
    commits: [
      {
        index: 1,
        hash: "1234567890abcdef",
        shortHash: "1234567",
        author: "Dev",
        email: "dev@example.com",
        date: "2026-10-01",
        subject: "feat: initial feature",
        type: "feat",
        scope: null,
        filesChanged: 10,
        insertions: 1000,
        deletions: 0,
        net: 1000,
        cumulativeNet: 1000,
        cumulativeInsertions: 1000,
        cumulativeDeletions: 0,
      }
    ],
    extensions: [
      { extension: ".ts", count: 10, lines: 1000, filePercent: "50.0", linePercent: "66.7" },
      { extension: ".md", count: 10, lines: 500, filePercent: "50.0", linePercent: "33.3" }
    ],
    generatedAt: "2026-10-07T00:00:00.000Z",
  };

  const html = generateHtmlDashboard(mockStats);
  assert.ok(html.includes("<!DOCTYPE html>"), "includes doctype");
  assert.ok(html.includes("Repository Statistics"), "includes title");
  assert.ok(html.includes("chart.js"), "includes Chart.js CDN reference");
  assert.ok(html.includes("initial feature"), "includes mock commit data");
});
