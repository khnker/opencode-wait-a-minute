import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { filterNewContext } from "../src/context/context-dedupe.js";
import { reduceToolOutput } from "../src/context/tool-output-reducer.js";
import { buildContextBrief } from "../src/context/context-brief.js";

const tokens = (text) => Math.ceil(String(text || "").length / 4);

function simulate(turns) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-curation-"));
  const sessionID = `curation-${turns}`;
  const contextBlock = [
    "[wam N1 project] project summary with recent changes and decisions",
    "[wam N2 task] task: demo — IMPLEMENTING / APPROVED",
    "req: r1 pending; next: implement endpoint",
    "[wam skills] codebase-design, writing-for-agents",
  ].join("\n");
  const toolOutput = "tool result line\n".repeat(2500);

  let baseline = 0;
  let curated = 0;
  for (let i = 0; i < turns; i++) {
    baseline += tokens(contextBlock) + tokens(toolOutput);
    const fresh = filterNewContext([contextBlock], { root, sessionID });
    const reduced = reduceToolOutput({
      toolName: "bash",
      text: toolOutput,
      root,
      taskId: sessionID,
    });
    curated += tokens(fresh.join("\n")) + tokens(reduced.text);
  }
  fs.rmSync(root, { recursive: true, force: true });
  return { turns, baseline, curated, savingsPct: ((baseline - curated) / baseline) * 100 };
}

test("context curation produces real token savings across turn counts", () => {
  for (const turns of [5, 10, 25]) {
    const r = simulate(turns);
    assert.ok(r.baseline > 0);
    assert.ok(r.curated < r.baseline, `no savings at ${turns} turns`);
    assert.ok(r.savingsPct >= 60, `expected >=60% savings at ${turns} turns, got ${r.savingsPct.toFixed(1)}%`);
    console.log(`turns=${r.turns} baseline=${r.baseline} curated=${r.curated} savings=${r.savingsPct.toFixed(1)}%`);
  }
});

test("compaction brief is smaller than the raw task state", () => {
  const requirements = Array.from({ length: 50 }, (_, i) => ({
    id: `r${i}`,
    title: `requirement ${i} with a reasonably long description`,
    status: i % 3 === 0 ? "verified" : "pending",
    evidence: i % 3 === 0 ? ["proof"] : [],
  }));
  const state = {
    phase: "IMPLEMENTING",
    contract: {
      status: "APPROVED",
      objective: "Implement a large feature",
      constraints: ["no production writes"],
      nonGoals: ["UI work"],
      unknowns: [],
    },
    requirements,
    lastAction: "implement feature",
  };
  const decisions = Array.from({ length: 20 }, (_, i) => ({ decision: `decision ${i} about the implementation` }));
  const entities = Array.from({ length: 20 }, (_, i) => ({ kind: "file", value: `src/module-${i}.js` }));

  const rawTokens = tokens(JSON.stringify(state));
  const brief = buildContextBrief({ taskId: "task-1", taskState: state, decisions, entities });
  assert.ok(brief.tokens < rawTokens, `brief ${brief.tokens} vs raw ${rawTokens}`);
  assert.ok(brief.text.includes("Implement a large feature"));
  assert.ok(brief.tokens <= 1200, `brief too large: ${brief.tokens}`);
  console.log(`compaction raw=${rawTokens} brief=${brief.tokens} savings=${(100 - (brief.tokens / rawTokens) * 100).toFixed(1)}%`);
});
