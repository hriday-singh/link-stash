import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Analyzes git history and tracked repository files.
 * @param {string} repoRoot - Absolute path to repo root.
 * @returns {object} Comprehensive repository stats.
 */
export function analyzeGitRepo(repoRoot) {
  const commits = parseGitLog(repoRoot);
  const trackedFiles = parseTrackedFiles(repoRoot);
  const extensions = computeExtensionStats(repoRoot, trackedFiles);
  const summary = computeSummary(commits, trackedFiles, extensions);

  return {
    summary,
    commits,
    extensions,
    generatedAt: new Date().toISOString(),
  };
}

function parseGitLog(repoRoot) {
  const delimiter = "---COMMIT_DELIMITER---";
  const rawOutput = execSync(
    `git log --reverse --format="${delimiter}%n%H|%h|%an|%ae|%aI|%ad|%s" --date=short --shortstat`,
    {
      cwd: repoRoot,
      encoding: "utf-8",
      maxBuffer: 20 * 1024 * 1024,
    }
  );

  const rawBlocks = rawOutput
    .split(delimiter)
    .map((b) => b.trim())
    .filter(Boolean);

  let cumulativeNet = 0;
  let cumulativeInsertions = 0;
  let cumulativeDeletions = 0;

  return rawBlocks.map((block, index) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const metaLine = lines[0] || "";
    const [fullHash, shortHash, author, email, isoDate, date, ...subjectParts] =
      metaLine.split("|");
    const subject = subjectParts.join("|") || "";

    const statLine = lines.length > 1 ? lines[lines.length - 1] : "";

    const filesMatch = statLine.match(/(\d+)\s+file/);
    const insertionsMatch = statLine.match(/(\d+)\s+insertion/);
    const deletionsMatch = statLine.match(/(\d+)\s+deletion/);

    const filesChanged = filesMatch ? parseInt(filesMatch[1], 10) : 0;
    const insertions = insertionsMatch ? parseInt(insertionsMatch[1], 10) : 0;
    const deletions = deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0;
    const net = insertions - deletions;

    cumulativeNet += net;
    cumulativeInsertions += insertions;
    cumulativeDeletions += deletions;

    const commitTypeInfo = parseCommitType(subject);

    return {
      index: index + 1,
      hash: fullHash || "",
      shortHash: shortHash || "",
      author: author || "Unknown",
      email: email || "",
      isoDate: isoDate || "",
      date: date || "",
      subject,
      type: commitTypeInfo.type,
      scope: commitTypeInfo.scope,
      filesChanged,
      insertions,
      deletions,
      net,
      cumulativeNet,
      cumulativeInsertions,
      cumulativeDeletions,
    };
  });
}

function parseCommitType(subject) {
  const conventionalMatch = subject.match(
    /^([a-z]+)(?:\(([^\)]+)\))?!?:\s*(.+)$/i
  );
  if (conventionalMatch) {
    return {
      type: conventionalMatch[1].toLowerCase(),
      scope: conventionalMatch[2] || null,
      message: conventionalMatch[3],
    };
  }

  const lower = subject.toLowerCase();
  if (lower.startsWith("add ") || lower.startsWith("feat")) {
    return { type: "feat", scope: null, message: subject };
  }
  if (lower.startsWith("fix ") || lower.startsWith("patch")) {
    return { type: "fix", scope: null, message: subject };
  }
  if (lower.startsWith("test ") || lower.includes("test")) {
    return { type: "test", scope: null, message: subject };
  }
  if (lower.startsWith("chore ") || lower.includes("ci")) {
    return { type: "chore", scope: null, message: subject };
  }
  if (lower.startsWith("doc") || lower.includes("spec") || lower.includes("tracker")) {
    return { type: "docs", scope: null, message: subject };
  }

  return { type: "other", scope: null, message: subject };
}

function parseTrackedFiles(repoRoot) {
  const output = execSync("git ls-files", {
    cwd: repoRoot,
    encoding: "utf-8",
  });
  return output
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
}

function computeExtensionStats(repoRoot, trackedFiles) {
  const map = new Map();

  for (const relativePath of trackedFiles) {
    const fullPath = path.join(repoRoot, relativePath);
    const ext = path.extname(relativePath).toLowerCase() || "[no extension]";
    const lines = countFileLines(fullPath);

    if (!map.has(ext)) {
      map.set(ext, { extension: ext, count: 0, lines: 0 });
    }

    const current = map.get(ext);
    current.count += 1;
    current.lines += lines;
  }

  const results = Array.from(map.values());
  results.sort((a, b) => b.lines - a.lines || b.count - a.count);

  const totalLines = results.reduce((acc, curr) => acc + curr.lines, 0);
  const totalFiles = trackedFiles.length;

  return results.map((item) => ({
    ...item,
    filePercent: totalFiles > 0 ? ((item.count / totalFiles) * 100).toFixed(1) : "0.0",
    linePercent: totalLines > 0 ? ((item.lines / totalLines) * 100).toFixed(1) : "0.0",
  }));
}

function countFileLines(fullPath) {
  if (!fs.existsSync(fullPath)) return 0;
  try {
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() || stat.size > 5 * 1024 * 1024) return 0;

    const buffer = fs.readFileSync(fullPath);
    // Detect binary files via null byte check in first 1024 bytes
    const checkLength = Math.min(buffer.length, 1024);
    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0) return 0;
    }

    const content = buffer.toString("utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

function computeSummary(commits, trackedFiles, extensions) {
  const totalCommits = commits.length;
  const totalFiles = trackedFiles.length;
  const totalTrackedLines = extensions.reduce((acc, curr) => acc + curr.lines, 0);

  const totalAdditions = commits.reduce((acc, curr) => acc + curr.insertions, 0);
  const totalDeletions = commits.reduce((acc, curr) => acc + curr.deletions, 0);
  const netLines = totalAdditions - totalDeletions;
  const totalFilesChanged = commits.reduce((acc, curr) => acc + curr.filesChanged, 0);

  const authorsMap = new Map();
  const typesMap = new Map();

  for (const c of commits) {
    // Author aggregation
    if (!authorsMap.has(c.author)) {
      authorsMap.set(c.author, {
        author: c.author,
        commits: 0,
        insertions: 0,
        deletions: 0,
        net: 0,
      });
    }
    const a = authorsMap.get(c.author);
    a.commits += 1;
    a.insertions += c.insertions;
    a.deletions += c.deletions;
    a.net += c.net;

    // Type aggregation
    const count = typesMap.get(c.type) || 0;
    typesMap.set(c.type, count + 1);
  }

  const authorStats = Array.from(authorsMap.values()).sort(
    (a, b) => b.commits - a.commits
  );

  const typeStats = Array.from(typesMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalCommits,
    totalFiles,
    totalTrackedLines,
    totalAdditions,
    totalDeletions,
    netLines,
    avgInsertionsPerCommit:
      totalCommits > 0 ? Math.round(totalAdditions / totalCommits) : 0,
    avgDeletionsPerCommit:
      totalCommits > 0 ? Math.round(totalDeletions / totalCommits) : 0,
    avgFilesPerCommit:
      totalCommits > 0 ? (totalFilesChanged / totalCommits).toFixed(1) : "0",
    firstCommitDate: commits[0]?.date || "N/A",
    latestCommitDate: commits[commits.length - 1]?.date || "N/A",
    authors: authorStats,
    commitTypes: typeStats,
  };
}
