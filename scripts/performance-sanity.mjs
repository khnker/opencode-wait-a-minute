#!/usr/bin/env node
/**
 * Real runtime performance baseline for the RC1 release gate.
 *
 * Measures ACTUAL in-process latencies (not file existence) for the seven
 * phases required by openspec/changes/rc1-release-engineering/specs/
 * rc1-release-evidence/spec.md:
 *
 *   preflight, classification, context assembly, skill routing,
 *   continuation fast-path, completion gate, task persistence.
 *
 * Each phase is executed N >= 30 times against the plugin's real exported
 * functions and reported as median / p95 / p99 in milliseconds.
 *
 * Exit 0 on success. No top-level `return` (valid ESM).
 */

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { performance } from "node:perf_hooks";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), "..");
const TRIALS = Number(process.env.WAM_PERF_TRIALS || 30);
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

/** Load a module by absolute path (ESM). */
function load(rel) {
  return import(pathToFileURL(join(REPO_ROOT, rel)).href);
}

/** Linear-interpolated percentile over an already time-ordered sample set. */
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    n: sorted.length,
    median: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

const fmt = (ms) => `${ms.toFixed(3)}ms`;
const PHASE_WIDTH = 22;

function printRow(phase, s) {
  console.log(
    `${phase.padEnd(PHASE_WIDTH)} | ${fmt(s.median).padStart(9)} | ` +
      `${fmt(s.p95).padStart(9)} | ${fmt(s.p99).padStart(9)}`,
  );
}

/**
 * Build the seven phase runners. Each runner closes over the real imported
 * functions and performs one genuine invocation per call.
 */
async function buildPhases() {
  const [
    { classifyContextItems },
    { build },
    { routeWithConstraints },
    { checkContinuation },
    { isCompletionAllowed },
    engine,
  ] = await Promise.all([
    load("src/context/context-classification.js"),
    load("src/context/context-builder.js"),
    load("src/skills/skill-routing.js"),
    load("src/context/context-snapshot.js"),
    load("src/verification/completion-gate.js"),
    load("src/skills/engine.js"),
  ]);

  const { classifyRequest, detectStack, persistTaskState, getTaskState } = engine;

  // Scratch root for phases that touch disk (persistence + snapshots).
  const scratchRoot = mkdtempSync(join(tmpdir(), "wam-perf-"));
  const taskId = "__perf_probe__";

  // Unmeasured setup: seed a real task state so the completion gate has a
  // genuine task to evaluate (it dereferences the persisted requirements).
  persistTaskState(
    taskId,
    {
      taskId,
      requirements: [{ id: "r1", status: "pending", evidence: [] }],
      updatedAt: Date.now(),
    },
    scratchRoot,
  );

  const samplePrompt =
    "Rediseñar el pipeline de contexto para reducir latencia en producción";
  const classificationItems = Array.from({ length: 12 }, (_, i) => ({
    id: `item-${i}`,
    text: i % 3 === 0
      ? "The build failed with a stack trace error"
      : "The result concluded and the task is complete",
    content: "El resultado concluyó y la tarea está completa",
    type: i % 4 === 0 ? "ERROR" : "RESULT",
    lastAccess: Date.now(),
  }));
  const contextItems = Array.from({ length: 20 }, (_, i) => ({
    id: `ctx-${i}`,
    content: `Contexto sintético número ${i} para medición de ensamblado`,
    text: `synthetic context ${i}`,
    category: "FACT",
    lastAccess: Date.now(),
  }));
  const candidateSkills = ["backend-exec", "frontend-exec", "debugger"];
  const targetFiles = ["src/api/users.ts", "src/frontend/app.component.ts"];

  const phases = [
    {
      name: "preflight",
      run() {
        // Real pre-flight cognitive analysis: request classification + stack detection.
        classifyRequest(samplePrompt);
        detectStack(REPO_ROOT);
      },
    },
    {
      name: "classification",
      run() {
        classifyContextItems(classificationItems);
      },
    },
    {
      name: "context assembly",
      run() {
        build({
          context: contextItems,
          memory: contextItems.slice(0, 5),
          decision: [],
          query: { keywords: ["contexto", "latencia"] },
          options: { maxItems: 10, ttl: 600000 },
        });
      },
    },
    {
      name: "skill routing",
      run() {
        routeWithConstraints(candidateSkills, targetFiles, {});
      },
    },
    {
      name: "continuation fast-path",
      run() {
        checkContinuation(
          taskId,
          { taskId, requirements: [], updatedAt: Date.now() },
          scratchRoot,
        );
      },
    },
    {
      name: "completion gate",
      run() {
        isCompletionAllowed(scratchRoot, taskId);
      },
    },
    {
      name: "task persistence",
      run() {
        persistTaskState(
          taskId,
          {
            taskId,
            requirements: [{ id: "r1", status: "pending", evidence: [] }],
            updatedAt: Date.now(),
          },
          scratchRoot,
        );
        getTaskState(taskId, scratchRoot);
      },
    },
  ];

  // Ensure every phase is backed by a real function.
  for (const phase of phases) {
    if (typeof phase.run !== "function") {
      throw new Error(`phase "${phase.name}" has no runnable implementation`);
    }
  }

  return { phases, scratchRoot };
}

async function main() {
  const t0 = performance.now();
  const { phases, scratchRoot } = await buildPhases();

  console.log(`\nRC1 real runtime performance baseline — ${TRIALS} trials/phase\n`);
  console.log(
    `${"phase".padEnd(PHASE_WIDTH)} | ${"median".padStart(9)} | ` +
      `${"p95".padStart(9)} | ${"p99".padStart(9)}`,
  );
  console.log("-".repeat(PHASE_WIDTH + 3 + 9 * 3 + 6));

  const all = [];
  try {
    for (const phase of phases) {
      // Warm-up invocation (not measured).
      phase.run();

      const samples = [];
      for (let i = 0; i < TRIALS; i++) {
        const start = performance.now();
        phase.run();
        samples.push(performance.now() - start);
      }
      all.push(...samples);
      printRow(phase.name, summarize(samples));
    }
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }

  console.log("-".repeat(PHASE_WIDTH + 3 + 9 * 3 + 6));
  printRow("OVERALL", summarize(all));

  const totalMs = performance.now() - t0;
  console.log(
    `\n${GREEN}Perf sanity OK${RESET} — ${all.length} measured calls in ${totalMs.toFixed(1)}ms ` +
      `(trials/phase=${TRIALS})\n`,
  );
}

main().catch((err) => {
  console.error(`\nperf sanity FAILED: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});
