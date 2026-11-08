import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function walkJsFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      found.push(...walkJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".js") && !entry.name.includes(".test.")) {
      found.push(full);
    }
  }
  return found;
}

test("the dead web dashboard module is gone", () => {
  assert.equal(fs.existsSync(path.join(repoRoot, "src", "integration", "web-dashboard.js")), false);
});

test("no runtime source references the web dashboard", () => {
  const files = [path.join(repoRoot, "index.js"), ...walkJsFiles(path.join(repoRoot, "src"))];
  const offenders = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    if (source.includes("startWebDashboard") || source.includes("web-dashboard")) {
      offenders.push(path.relative(repoRoot, file));
    }
  }
  assert.deepEqual(offenders, []);
});
