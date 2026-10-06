import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Define boundary rules: Layer -> Forbidden imports
const BOUNDARIES = {
  "domain": ["index.js", "engine.js"], // Domain shouldn't import entry points
  "verification": ["index.js", "engine.js"],
  "cognition": ["index.js", "engine.js", "verification/"],
};

test("Architecture Boundary: Domain should not import Runtime", () => {
  const root = process.cwd();
  const domainFiles = ["src/evidence/evidence.js", "src/verification/verification.js", "src/cognition/cognition-store.js"];
  
  const SPEC_RE =
    /(?:import|export)[^"']*from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']|require\s*\(\s*["']([^"']+)["']/g;

  for (const file of domainFiles) {
    const content = fs.readFileSync(path.join(root, file), "utf-8");
    const specs = [...content.matchAll(SPEC_RE)].map((m) => m[1] || m[2] || m[3]);
    for (const forbidden of BOUNDARIES["domain"]) {
      const imported = specs.some(
        (s) => s === forbidden || s.endsWith("/" + forbidden)
      );
      assert.ok(!imported, `File ${file} should not import ${forbidden}`);
    }
  }
});
