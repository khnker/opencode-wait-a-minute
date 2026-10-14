#!/usr/bin/env node
/**
console.log("Benchmark started with PID:", process.pid);
 * benchmarks/task-conditioned-role-replacement/run-benchmark.mjs
 *
 * CLI entry for the task-conditioned-role-replacement benchmark.
 *
 * Reads fixtures from ./fixtures/scenarios.jsonl, runs selectRole against
 * each, computes (a) selection accuracy, (b) confidence bucket match,
 * (c) idempotence, and (d) suffix-vs-prompt conflict resolution rate.
 *
 * Usage:
 *   node run-benchmark.mjs                  # human-readable
 *   node run-benchmark.mjs --report json   # JSON to stdout
 *   node run-benchmark.mjs --threshold 0.85 # override accuracy threshold
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  selectRole,
  ROLE,
} from '../../src/cognition/task-role-engine.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(HERE, 'fixtures', 'scenarios.jsonl');

function parseArgs(argv) {
  const out = { report: 'human', threshold: 0.85 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--report') out.report = argv[++i];
    else if (argv[i] === '--threshold') out.threshold = parseFloat(argv[++i]);
  }
  return out;
}

function expectedConfidenceBucket(value) {
  if (value === 'high') return 0.6;
  if (value === 'med') return 0.4;
  return 0.0; // 'low' → tolerance 0.2
}

function loadFixtures() {
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error(`fixtures not found at ${FIXTURE_PATH}`);
  }
  return fs.readFileSync(FIXTURE_PATH, 'utf-8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
}

function bucket(actual) {
  if (actual >= 0.6) return 'high';
  if (actual >= 0.3) return 'med';
  return 'low';
}

function runScenario(scenario) {
  const input = {
    objective: scenario.objective || '',
    requirements: scenario.requirements || [],
  };
  const a = selectRole(input);
  const b = selectRole(input); // idempotence check

  const idempotent = JSON.stringify(a) === JSON.stringify(b);
  const correctRole = a.role === scenario.expectedRole;
  const confidenceMatch =
    Math.abs(a.confidence - expectedConfidenceBucket(scenario.expectedConfidence)) <= 0.25;

  return {
    input,
    expectedRole: scenario.expectedRole,
    actualRole: a.role,
    expectedConfidence: scenario.expectedConfidence,
    actualConfidence: a.confidence,
    correctRole,
    confidenceMatch,
    idempotent,
    signalCount: a.evidence.length,
  };
}

function aggregate(results) {
  const total = results.length;
  const correctRole = results.filter((r) => r.correctRole).length;
  const idempotent = results.filter((r) => r.idempotent).length;
  const confidenceMatches = results.filter((r) => r.confidenceMatch).length;

  // Conflict resolution: scenarios where a free-text prompt verb would
  // push toward one role but a requirement-suffix pushes toward another.
  const conflictCases = results.filter((r) => {
    const obj = (r.input.objective || "").toLowerCase();
    const promptVerb = /\b(implement|build|verify|review|deploy|document|plan)\b/.test(obj);
    const suffix = r.input.requirements.some((req) =>
      /-(verify|review|rollback|monitor|docs)\b/.test((req.id || "").toLowerCase()),
    );
    return promptVerb && suffix;
  });
  // A conflict is "resolved correctly" when the actual role matches the
  // requirement-suffix signal (which has higher weight by design).
  const conflictResolved = conflictCases.filter((r) => r.correctRole).length;

  return {
    totalScenarios: total,
    selectionAccuracy: total ? correctRole / total : 0,
    idempotenceRate: total ? idempotent / total : 0,
    confidenceMatchRate: total ? confidenceMatches / total : 0,
    conflictCasesEvaluated: conflictCases.length,
    conflictResolutionRate: conflictCases.length
      ? conflictResolved / conflictCases.length
      : 0,
  };
}

function reportHuman(metrics, failures) {
  console.log('Task-Conditioned Role Replacement Benchmark');
  console.log('==========================================');
  console.log(`Scenarios:           ${metrics.totalScenarios}`);
  console.log(`Selection accuracy:  ${(metrics.selectionAccuracy * 100).toFixed(1)}%`);
  console.log(`Idempotence:         ${(metrics.idempotenceRate * 100).toFixed(1)}%`);
  console.log(`Confidence match:    ${(metrics.confidenceMatchRate * 100).toFixed(1)}%`);
  console.log(`Conflict resolution: ${(metrics.conflictResolutionRate * 100).toFixed(1)}% (${metrics.conflictCasesEvaluated} cases)`);

  if (failures.length > 0) {
    console.log(`\n${failures.length} failures:`);
    for (const f of failures) {
      console.log(`  - expected=${f.expectedRole} got=${f.actualRole} | obj="${f.objective}" reqs=${JSON.stringify(f.requirements)}`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const scenarios = loadFixtures();
  const results = scenarios.map(runScenario);
  const metrics = aggregate(results);
  const failures = results
    .filter((r) => !r.correctRole)
    .map((r) => ({
      objective: r.input.objective,
      requirements: r.input.requirements,
      expectedRole: r.expectedRole,
      actualRole: r.actualRole,
    }));

  if (args.report === 'json') {
    console.log(JSON.stringify({ metrics, results }, null, 2));
  } else {
    reportHuman(metrics, failures);
  }

  const passed = metrics.selectionAccuracy >= args.threshold;
  if (!passed) {
    console.error(`\nFAIL: selection accuracy ${(metrics.selectionAccuracy * 100).toFixed(1)}% < threshold ${(args.threshold * 100).toFixed(0)}%`);
    process.exit(1);
  }
  process.exit(0);
}

main();
