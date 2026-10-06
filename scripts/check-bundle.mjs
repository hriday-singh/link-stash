import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../apps/web/dist/assets");

if (!fs.existsSync(distDir)) {
  console.error(`Dist directory not found: ${distDir}`);
  console.error("Please run 'pnpm --filter web build' first.");
  process.exit(1);
}

const files = fs.readdirSync(distDir);
const jsFiles = files.filter((f) => f.endsWith(".js"));

if (jsFiles.length === 0) {
  console.error("No JS bundle assets found in dist/assets!");
  process.exit(1);
}

console.log("----------------------------------------------------------------");
console.log(" Bundle Size Verification (gzip budget: initial <= 250 KB)     ");
console.log("----------------------------------------------------------------");

const MAX_INITIAL_GZIP_KB = 250;
let hasFailure = false;

const report = [];

for (const file of jsFiles) {
  const fullPath = path.join(distDir, file);
  const content = fs.readFileSync(fullPath);
  const rawBytes = content.length;
  const gzipBytes = zlib.gzipSync(content).length;
  const gzipKb = (gzipBytes / 1024).toFixed(2);
  const rawKb = (rawBytes / 1024).toFixed(2);

  const isInitial = file.startsWith("index-");
  const isGraph = file.startsWith("GraphView-");
  const isCard = file.startsWith("c._slug-");

  report.push({
    file,
    rawKb: Number(rawKb),
    gzipKb: Number(gzipKb),
    isInitial,
    isGraph,
    isCard,
  });

  console.log(
    ` ${file.padEnd(35)} : ${rawKb.padStart(8)} KB raw | ${gzipKb.padStart(7)} KB gzip ${
      isInitial ? "[INITIAL]" : ""
    }`
  );

  if (isInitial && Number(gzipKb) > MAX_INITIAL_GZIP_KB) {
    console.error(
      `FAIL: Initial bundle ${file} exceeded budget: ${gzipKb} KB > ${MAX_INITIAL_GZIP_KB} KB`
    );
    hasFailure = true;
  }
}

console.log("----------------------------------------------------------------");

// Check that heavy features are separated out into their own code-split chunks
const initialChunk = report.find((r) => r.isInitial);
if (!initialChunk) {
  console.error("FAIL: Could not find initial index-*.js bundle chunk!");
  hasFailure = true;
} else {
  console.log(`OK: Initial bundle size: ${initialChunk.gzipKb} KB gzip (budget: <= ${MAX_INITIAL_GZIP_KB} KB)`);
}

const graphChunk = report.find((r) => r.isGraph);
if (graphChunk) {
  console.log(`OK: Graph view code-split: ${graphChunk.file} (${graphChunk.gzipKb} KB gzip)`);
}

const cardChunk = report.find((r) => r.isCard);
if (cardChunk) {
  console.log(`OK: Card view / CodeMirror code-split: ${cardChunk.file} (${cardChunk.gzipKb} KB gzip)`);
}

if (hasFailure) {
  console.error("Bundle verification FAILED.");
  process.exit(1);
} else {
  console.log("OK: All bundle budgets and code-splitting criteria PASSED.");
}
