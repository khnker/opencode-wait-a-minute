
import { execSync } from "node:child_process";
import { buildRuntimeContextGraph } from "../../runtime-context-graph.js";

export function getRepoCommit(cwd = process.cwd()) {
  try {
    return execSync("git rev-parse HEAD", { cwd, encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

export async function runBaselineTurn({ scenario, turn, turnIndex, provider, repoCommit }) {
  const graph = buildRuntimeContextGraph(turn.input);
  const nodes = graph.getNodes();
  const sortedNodes = Array.from(nodes.values()).sort((a, b) => a.createdAt - b.createdAt);
  const rawContext = sortedNodes.map(n => `[Type: ${n.type}]\n${n.content}\n---`).join("\n");
  const prompt = `${rawContext}\n\n[Task]\n${turn.prompt}`;
  
  const { text, usage } = await provider.complete({
    messages: [{ role: "user", content: prompt }],
    maxTokens: 4096
  });

  return {
    arm: "baseline",
    scenarioId: scenario.id,
    turnIndex,
    repoCommit,
    model: provider.model ?? null,
    prompt,
    response: text,
    usage
  };
}
