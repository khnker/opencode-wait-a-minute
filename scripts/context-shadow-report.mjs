#!/usr/bin/env node
/**
 * scripts/context-shadow-report.mjs — read-only promotion gate for shadow telemetry.
 *
 * Reads `.wam/context-shadow.jsonl` (or WAM_METRICS_DIR) and decides whether the
 * shadow phase has enough clean, in-budget, non-contradictory evidence to activate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { shadowRecordPath } from "../src/context/context-shadow.js";

export const DEFAULT_MIN_RECORDS = 20;
export const DEFAULT_MAX_DELTA_RATIO = 1.0;

function parseRecords(records) {
  const parsed = [];
  const errors = [];
  records.forEach((entry, index) => {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      parsed.push({ record: entry, line: index + 1 });
      return;
    }
    try {
      const value = JSON.parse(String(entry));
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("not a JSON object");
      }
      parsed.push({ record: value, line: index + 1 });
    } catch (error) {
      errors.push(`line ${index + 1}: ${error.message}`);
    }
  });
  return { parsed, errors };
}

function deltaRatio(record) {
  const delta = Math.abs(Number(record.deltaChars) || 0);
  const injected = Number(record.injectedChars) || 0;
  if (injected === 0) return delta === 0 ? 0 : Number.POSITIVE_INFINITY;
  return delta / injected;
}

function evaluatedEntries(parsed, windowSize) {
  return parsed
    .filter(({ record }) => record.projectionAvailable === true)
    .slice(-windowSize);
}

function selfContradictoryIds(record) {
  const requirements = record.requirements || {};
  const omitted = new Set(Array.isArray(requirements.omitted) ? requirements.omitted : []);
  const included = Array.isArray(requirements.included) ? requirements.included : [];
  return included.filter((id) => omitted.has(id));
}

function percentile(sorted, ratio) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

export function evaluateShadowRecords(records, options = {}) {
  const minRecords = options.minRecords ?? DEFAULT_MIN_RECORDS;
  const maxDeltaRatio = options.maxDeltaRatio ?? DEFAULT_MAX_DELTA_RATIO;
  const { parsed, errors } = parseRecords(records);
  const list = parsed.map((entry) => entry.record);
  const availability = list.reduce(
    (counts, record) => {
      if (record.projectionAvailable === true) counts.available += 1;
      else if (record.projectionAvailable === false) counts.fallback += 1;
      else counts.unknown += 1;
      return counts;
    },
    { available: 0, fallback: 0, unknown: 0 },
  );

  const windowSize = options.windowSize ?? minRecords;
  const evaluated = windowSize <= 0 ? [] : evaluatedEntries(parsed, windowSize);
  const window = evaluated.map((entry) => entry.record);

  const badMode = evaluated.filter(({ record }) => {
    const mode = record.mode ?? record.projectionMode;
    return String(mode ?? "").toLowerCase() !== "shadow";
  });
  const overBudget = evaluated.filter(
    ({ record }) => Number(record.shadowChars) > Number(record.budgetChars),
  );
  const badDelta = evaluated.filter(({ record }) => deltaRatio(record) > maxDeltaRatio);
  const contradictory = evaluated
    .map(({ record, line }) => ({ line, ids: selfContradictoryIds(record) }))
    .filter((entry) => entry.ids.length > 0);

  const maxDelta = window.reduce((max, record) => Math.max(max, deltaRatio(record)), 0);
  const deltas = window
    .map((record) => Math.abs(Number(record.deltaChars) || 0))
    .sort((a, b) => a - b);
  const timestamps = window
    .map((record) => record.timestamp ?? record.ts ?? record.at)
    .filter((value) => typeof value === "string")
    .sort();
  const equivalent = list.filter((record) => record.equivalent === true).length;
  const omittedIds = window.reduce(
    (sum, record) =>
      sum + (Array.isArray(record.requirements?.omitted) ? record.requirements.omitted.length : 0),
    0,
  );
  const pendingIds = window.reduce(
    (sum, record) =>
      sum + (Array.isArray(record.requirements?.pending) ? record.requirements.pending.length : 0),
    0,
  );
  const conflictIds = window.reduce(
    (sum, record) =>
      sum + (Array.isArray(record.requirements?.conflicts) ? record.requirements.conflicts.length : 0),
    0,
  );
  const injectedTokens = window.reduce(
    (sum, record) => sum + (Number(record.injectedTokenEstimate) || 0),
    0,
  );
  const shadowTokens = window.reduce(
    (sum, record) => sum + (Number(record.shadowTokenEstimate) || 0),
    0,
  );

  const gates = [
    {
      name: "records",
      pass: evaluated.length >= minRecords,
      detail: `${evaluated.length} available record(s), minimum ${minRecords} (window ${windowSize}); fallback ${availability.fallback}, unknown ${availability.unknown} excluded`,
    },
    {
      name: "parse",
      pass: errors.length === 0,
      detail: errors.length > 0 ? errors.join("; ") : "all lines parsed",
    },
    {
      name: "mode",
      pass: badMode.length === 0,
      detail:
        badMode.length > 0
          ? `non-shadow mode at line(s) ${badMode.map((entry) => entry.line).join(", ")}`
          : "all evaluated records in shadow mode",
    },
    {
      name: "budget",
      pass: overBudget.length === 0,
      detail:
        overBudget.length > 0
          ? `shadowChars > budgetChars at line(s) ${overBudget
              .map((entry) => entry.line)
              .join(", ")}`
          : "shadow chars within budget",
    },
    {
      name: "delta",
      pass: badDelta.length === 0,
      detail: `max ratio ${maxDelta.toFixed(3)}, allowed ${maxDeltaRatio}`,
    },
    {
      name: "selection",
      pass: contradictory.length === 0,
      detail:
        contradictory.length > 0
          ? contradictory
              .map((entry) => `line ${entry.line}: ${entry.ids.join(", ")}`)
              .join("; ")
          : "included and omitted ids disjoint",
    },
  ];

  return {
    pass: gates.every((gate) => gate.pass),
    gates,
    summary: {
      count: list.length,
      evaluated: window.length,
      ...availability,
      firstTimestamp: timestamps[0] ?? null,
      lastTimestamp: timestamps[timestamps.length - 1] ?? null,
      equivalenceRate: list.length > 0 ? equivalent / list.length : 0,
      avgDeltaChars:
        deltas.length > 0 ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : 0,
      p95DeltaChars: percentile(deltas, 0.95),
      omittedIds,
      pendingIds,
      conflictIds,
      injectedTokens,
      shadowTokens,
    },
  };
}

function printUsage() {
  console.log(
    [
      "usage: node scripts/context-shadow-report.mjs [options]",
      "",
      "  --file <path>            telemetry file (default: <cwd>/.wam/context-shadow.jsonl)",
      "  --min-records <n>        required available projection records (default: 20)",
      "  --window <n>             evaluate the last n available records (default: min-records)",
      "  --max-delta-ratio <r>    allowed |deltaChars| / injectedChars (default: 1.0)",
      "",
      "exit: 0 pass, 1 gate failure, 2 missing telemetry",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const options = {
    file: null,
    minRecords: DEFAULT_MIN_RECORDS,
    maxDeltaRatio: DEFAULT_MAX_DELTA_RATIO,
    windowSize: null,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const [flag, inline] = argv[index].split("=");
    const value = () => (inline !== undefined ? inline : argv[(index += 1)]);
    if (flag === "--file") options.file = value();
    else if (flag === "--min-records") options.minRecords = Number(value());
    else if (flag === "--max-delta-ratio") options.maxDeltaRatio = Number(value());
    else if (flag === "--window") options.windowSize = Number(value());
    else if (flag === "--help" || flag === "-h") options.help = true;
    else throw new Error(`unknown argument: ${argv[index]}`);
  }
  if (!Number.isFinite(options.minRecords) || options.minRecords < 0) {
    throw new Error("--min-records must be a non-negative number");
  }
  if (!Number.isFinite(options.maxDeltaRatio) || options.maxDeltaRatio < 0) {
    throw new Error("--max-delta-ratio must be a non-negative number");
  }
  if (options.windowSize !== null && (!Number.isFinite(options.windowSize) || options.windowSize < 1)) {
    throw new Error("--window must be a positive number");
  }
  return options;
}

function printReport(file, result) {
  const { summary } = result;
  console.log(`file: ${file}`);
  console.log(`records: ${summary.count} (evaluated ${summary.evaluated})`);
  console.log(
    `window: ${summary.firstTimestamp ?? "n/a"} -> ${summary.lastTimestamp ?? "n/a"}`,
  );
  console.log(
    `availability: ${summary.available} available, ${summary.fallback} fallback, ${summary.unknown} unknown`,
  );
  console.log(`equivalence: ${(summary.equivalenceRate * 100).toFixed(1)}%`);
  console.log(
    `deltaChars: avg ${summary.avgDeltaChars.toFixed(1)}, p95 ${summary.p95DeltaChars}`,
  );
  console.log(`omitted ids: ${summary.omittedIds}`);
  console.log(`pending/conflict ids: ${summary.pendingIds}/${summary.conflictIds}`);
  console.log(`tokens: injected ${summary.injectedTokens}, shadow ${summary.shadowTokens}`);
  console.log("");

  const rows = result.gates.map((gate) => [gate.name, gate.pass ? "PASS" : "FAIL", gate.detail]);
  const widths = [0, 1, 2].map((column) =>
    Math.max(...rows.map((row) => row[column].length), 4),
  );
  const line = (row) =>
    row.map((cell, column) => cell.padEnd(widths[column])).join("  ").trimEnd();
  console.log(line(["gate", "state", "detail"]));
  console.log(line(widths.map((width) => "-".repeat(width))));
  for (const row of rows) console.log(line(row));
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`[context-shadow-report] ${error.message}`);
    return 2;
  }
  if (options.help) {
    printUsage();
    return 0;
  }

  const file = options.file
    ? path.resolve(options.file)
    : shadowRecordPath(process.cwd());
  if (!fs.existsSync(file)) {
    console.error(`[context-shadow-report] telemetry not found: ${file}`);
    return 2;
  }

  const lines = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "");
  const result = evaluateShadowRecords(lines, options);
  printReport(file, result);
  return result.pass ? 0 : 1;
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  process.exitCode = main(process.argv.slice(2));
}
