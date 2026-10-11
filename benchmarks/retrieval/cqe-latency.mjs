/**
 * CQE Latency & Token Benchmark (RNF)
 * Measures p50/p95 latency and token usage for CQE-augmented retrieval.
 */

import { retrieveWithCqe } from '../../src/context/cqe-adapter.js';
import { CORPORA, LABELED_QUERIES } from './labeled-queries.mjs';

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

async function runCqeLatencyBenchmark() {
  const corpusRoot = CORPORA.fixture;
  const queries = LABELED_QUERIES.slice(0, 10);
  const latencies = [];
  const tokenCounts = [];

  console.log(`Running CQE latency & token benchmark over ${queries.length} queries on fixture corpus...`);

  for (const lq of queries) {
    const start = performance.now();
    const result = await retrieveWithCqe(lq.query, {
      repoRoot: corpusRoot,
      mode: 'enabled',
      maxResults: 5,
    });
    const elapsed = performance.now() - start;
    latencies.push(elapsed);

    const tokens = (result.items || []).reduce(
      (sum, item) => sum + (item.tokenEstimate || Math.ceil((item.content?.length || 0) / 4)),
      0
    );
    tokenCounts.push(tokens);
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1];

  console.log('\n--- CQE Latency & Token Benchmark Results ---');
  console.log(`Queries evaluated: ${latencies.length}`);
  console.log(`p50 Latency: ${p50.toFixed(2)}ms`);
  console.log(`p95 Latency: ${p95.toFixed(2)}ms`);
  console.log(`Mean Latency: ${mean(latencies).toFixed(2)}ms (±${stddev(latencies).toFixed(2)})`);
  console.log(`Mean Tokens: ${mean(tokenCounts).toFixed(2)} (±${stddev(tokenCounts).toFixed(2)})`);
  console.log('---------------------------------------------');
}

runCqeLatencyBenchmark().catch(err => {
  console.error('CQE latency benchmark failed:', err);
  process.exit(1);
});
