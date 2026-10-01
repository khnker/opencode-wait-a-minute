
import { assembleContext } from "../../assembly.js";
import { logicalStateHash } from "../evaluation/state-equivalence.mjs";

export async function runWamTurn({ scenario, turn, turnIndex, provider, collector, repoCommit, root, budget }) {
  const assembly = assembleContext({
    prompt: turn.prompt,
    taskId: scenario.id,
    ...turn.input,
    projectPath: root,
    budget,
    collector
  });

  const prompt = assembly.lines.join("\n");

  const { text, usage } = await provider.complete({
    messages: [{ role: "user", content: prompt }],
    maxTokens: 4096
  });

  return {
    arm: "wam",
    scenarioId: scenario.id,
    turnIndex,
    repoCommit,
    model: provider.model ?? null,
    prompt,
    response: text,
    usage,
    counters: collector.snapshot(),
    levels: assembly.levels,
    logicalStateHash: logicalStateHash(turn.input)
  };
}
