import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { checkContinuation, rebuildScope, createSnapshot } from "../../context-snapshot.js";
import { createCollector } from "../instrumentation/collector.mjs";
import { runBaselineTurn } from "./baseline-runner.mjs";
import { runWamTurn } from "./wam-runner.mjs";

const sumTokens = (usage) => usage.inputTokens + usage.outputTokens;

export async function runRealScenario({ scenario, provider, repoCommit, root }) {
  const rootDir = root || fs.mkdtempSync(path.join(os.tmpdir(), "wam-bench-"));
  const collector = createCollector();
  const turns = [];

  for (const [i, turn] of scenario.turns.entries()) {
    const check = checkContinuation(scenario.id, turn.input.taskState, rootDir, collector);
    if (check.status === "VALID") {
      collector.record("Context_fast_path");
    } else {
      rebuildScope(check.changedSignals, collector);
    }

    const wam = await runWamTurn({
      scenario,
      turn,
      turnIndex: i,
      provider,
      collector,
      repoCommit,
      root: rootDir,
      budget: scenario.budget ?? turn.budget
    });

    const baseline = await runBaselineTurn({ scenario, turn, turnIndex: i, provider, repoCommit });

    createSnapshot(scenario.id, turn.input.taskState, rootDir);

    turns.push({ turnIndex: i, baseline, wam });
  }

  const totals = turns.reduce(
    (acc, { baseline, wam }) => {
      acc.baselineTokens += sumTokens(baseline.usage);
      acc.wamTokens += sumTokens(wam.usage);
      acc.baselineOutput += baseline.usage.outputTokens;
      acc.wamOutput += wam.usage.outputTokens;
      return acc;
    },
    { baselineTokens: 0, wamTokens: 0, baselineOutput: 0, wamOutput: 0 }
  );

  return { scenarioId: scenario.id, repoCommit, turns, totals, counters: collector.snapshot() };
}
