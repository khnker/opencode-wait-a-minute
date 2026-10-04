#!/usr/bin/env node
/**
 * Verify version parity between package.json and SKILL.md
 * Exits 0 if they match, 1 if they diverge.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = resolve(REPO_ROOT, "package.json");
const skillPath = resolve(REPO_ROOT, "SKILL.md");

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function parsePackageVersion() {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  return pkg.version;
}

function parseSkillVersion() {
  const content = readFileSync(skillPath, "utf8");
  const match = content.match(/^metadata:\s*\n\s*version:\s*([\d.]+)/m);
  if (!match) {
    fail("SKILL.md metadata.version not found (expected YAML frontmatter)");
  }
  return match[1];
}

const pkgVersion = parsePackageVersion();
const skillVersion = parseSkillVersion();

console.log(`package.json version: ${pkgVersion}`);
console.log(`SKILL.md version:     ${skillVersion}`);

if (pkgVersion !== skillVersion) {
  fail(`Version mismatch: package.json=${pkgVersion} vs SKILL.md=${skillVersion}`);
}

console.log("OK: versions match");