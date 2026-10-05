import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const REQUIRED_RUNTIME = ["index.js", "src/engine.js", "preflight/request-classifier.js", "skills/registry.json"];

let cachedPaths = null;
function packedPaths() {
  if (cachedPaths) return cachedPaths;
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  cachedPaths = JSON.parse(out)[0].files.map((f) => f.path);
  return cachedPaths;
}

test("published surface: package.json declares main and explicit files", () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.main, "index.js");
  assert.ok(Array.isArray(pkg.files) && pkg.files.length > 0, "files must be an explicit non-empty list");
  for (const req of ["*.js", "*.mjs", "preflight/", "skills/"]) {
    assert.ok(pkg.files.includes(req), `files must list ${req}`);
  }
});

test("published surface: no test or bench files shipped", () => {
  const offenders = packedPaths().filter(
    (p) => p.endsWith(".test.js") || p.endsWith(".test.mjs") || /^bench-.*\.mjs$/.test(p)
  );
  assert.deepEqual(offenders, [], `dev files must not ship in the tarball: ${offenders.join(", ")}`);
});

test("published surface: required runtime files shipped", () => {
  const paths = packedPaths();
  for (const req of REQUIRED_RUNTIME) {
    assert.ok(paths.includes(req), `tarball must include ${req}`);
  }
});
