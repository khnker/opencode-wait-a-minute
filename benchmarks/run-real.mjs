import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runRealScenario } from "./runners/real-session.mjs";
import { evaluateTask } from "./evaluation/success.mjs";
import { computeMetrics } from "./evaluation/metrics.mjs";
import { createProvider } from "./providers/openai-compatible.mjs";

export async function runRealSuite({ provider, scenarios, root, timestamp }) {
  const allScenarios = scenarios || (await import("./scenarios/real.mjs")).REAL_SCENARIOS;
  const results = [];
  const evaluations = [];

  for (const scenario of allScenarios) {
    const res = await runRealScenario({ scenario, provider, root });
    results.push(res);
    for (const turn of res.turns) {
      const evaluation = evaluateTask({ baseline: turn.baseline, wam: turn.wam });
      evaluations.push({ scenarioId: scenario.id, ...evaluation });
    }
  }

  return {
    benchmark: "real-llm",
    version: "1.0.0",
    mode: "real-llm",
    timestamp: timestamp || new Date().toISOString(),
    results,
    evaluations,
    metrics: computeMetrics({ results, evaluations })
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { WAM_BENCH_BASE_URL, WAM_BENCH_API_KEY, WAM_BENCH_MODEL } = process.env;
  if (!WAM_BENCH_BASE_URL) {
    console.log("[run-real] skipped: set WAM_BENCH_BASE_URL/WAM_BENCH_API_KEY/WAM_BENCH_MODEL to run");
    process.exit(0);
  }

  const provider = createProvider({
    baseUrl: WAM_BENCH_BASE_URL,
    apiKey: WAM_BENCH_API_KEY,
    model: WAM_BENCH_MODEL
  });

  const suite = await runRealSuite({ provider });
  const iso = new Date().toISOString().replace(/:/g, "-");
  const dir = path.join("benchmarks", "results", iso);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(suite, null, 2));
  console.log("Metrics:", suite.metrics);
}
