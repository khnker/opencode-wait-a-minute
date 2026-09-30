import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { runTraceReplay } from "./runners/trace-replay.mjs";
import { buildRawEvidence, buildSummary, buildReport } from "./reporters/json-reporter.mjs";
import {
  tokenConsumptionSvg,
  contextConsumptionSvg,
  savingsDistributionSvg,
  verifiedProgressSvg
} from "./charts/charts.mjs";

export const BENCHMARK_VERSION = "2.0.0";
export function runBenchmarkSuite(options = {}) {
  const timestamp = options.timestamp || new Date().toISOString();
  const suite = runTraceReplay();
  return { ...suite, timestamp };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const iso = new Date().toISOString().replace(/:/g, "-");
  const outDir = path.join(fileURLToPath(new URL(".", import.meta.url)), "results", iso);
  fs.mkdirSync(outDir, { recursive: true });
  const suite = runBenchmarkSuite();
  const summary = buildSummary(suite);
  fs.writeFileSync(path.join(outDir, "raw.json"), JSON.stringify(buildRawEvidence(suite), null, 2));
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outDir, "report.md"), buildReport(suite, summary));
  const chartsDir = path.join(outDir, "charts");
  fs.mkdirSync(chartsDir, { recursive: true });
  fs.writeFileSync(path.join(chartsDir, "token-consumption.svg"), tokenConsumptionSvg(suite));
  fs.writeFileSync(path.join(chartsDir, "context-consumption.svg"), contextConsumptionSvg(suite));
  fs.writeFileSync(
    path.join(chartsDir, "savings-distribution.svg"),
    savingsDistributionSvg(suite.results.map((r) => r.savings.inputSavingsPct))
  );
  fs.writeFileSync(path.join(chartsDir, "verified-progress.svg"), verifiedProgressSvg(suite));
  console.log(`Benchmark results written to: ${outDir}`);
}
