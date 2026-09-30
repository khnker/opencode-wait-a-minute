export const REAL_MODEL_RUNNER_VERSION = "1.0.0";
export const MIN_SAMPLE = 5; export const RECOMMENDED_SAMPLE = 10;
export function isRealModelEnabled() { return process.env.WAM_BENCH_REAL_MODEL === "1"; }
export async function runRealModelBenchmark({ scenario, repetitions = RECOMMENDED_SAMPLE } = {}) {
  if (!isRealModelEnabled()) throw new Error("real-model benchmark is opt-in; set WAM_BENCH_REAL_MODEL=1");
  if (repetitions < MIN_SAMPLE) throw new Error("Minimum samples required");
  throw new Error("Adapter required");
}
