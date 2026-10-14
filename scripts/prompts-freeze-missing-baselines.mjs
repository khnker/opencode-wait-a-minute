#!/usr/bin/env node
/**
 * Targeted baseline freezer for the 4 S5–S8 suites.
 *
 * Uses the existing `buildBaseline({suiteId})` mechanism (per-suite, just
 * like the CLI freeze). Refuses to overwrite an existing baseline file
 * (frozen-gold guard).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildBaseline,
  serializeBaseline,
  listSuites,
} from "../benchmarks/quality/prompt-eval/freeze-baseline.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASELINES_DIR = path.resolve(HERE, "..", "benchmarks", "quality", "prompt-eval", "baselines");
const WANTED = ["discovery", "runtime", "decision-gate", "completion"];

const existing = new Set(
  fs.readdirSync(BASELINES_DIR).filter((f) => f.endsWith(".json")),
);
const known = new Set(listSuites().map((s) => s.id));

const written = [];
for (const suiteId of WANTED) {
  if (!known.has(suiteId)) {
    console.error(`skip: suite "${suiteId}" not in suites/`);
    continue;
  }
  const target = path.join(BASELINES_DIR, `${suiteId}.json`);
  if (existing.has(`${suiteId}.json`)) {
    console.error(`skip: ${path.relative(process.cwd(), target)} already exists (frozen-gold guard)`);
    continue;
  }
  const baseline = buildBaseline({ suiteId });
  fs.writeFileSync(target, serializeBaseline(baseline), "utf8");
  written.push(path.relative(process.cwd(), target));
}
console.log(`wrote ${written.length} baseline file(s):`);
for (const file of written) console.log(` - ${file}`);
