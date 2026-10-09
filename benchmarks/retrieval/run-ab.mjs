/**
 * A/B benchmark runner for retrieval arms.
 * CLI usage: node run-ab.mjs [--corpus fixture|self] [--k 5] [--out benchmarks/results/retrieval]
 * When run directly, writes to benchmarks/results/retrieval by default and prints the output paths.
 */

import fs from 'fs';
import path from 'path';
import { precisionAtK, recallAtK, mrr, ndcgAtK, coverage, emptyRate, dedupRate, computeArmMetrics, computeQueryMetrics, tokensOf, computeTokenSavings } from './retrieval-metrics.mjs';
import { searchBaseline } from './search-baseline.mjs';
import { LABELED_QUERIES, CORPORA } from './labeled-queries.mjs';

// Delegation policy reference
import { shouldSearch } from './delegation-policy.mjs';

// Import the CQE adapter once at module load
let CQE_ADAPTER = null;
async function getCqeAdapter() {
  if (!CQE_ADAPTER) {
    CQE_ADAPTER = await import('../../src/context/cqe-adapter.js');
  }
  return CQE_ADAPTER;
}

/**
 * Retrieve using CQE engine (Arm B).
 * @param {string} queryText - Search query text.
 * @param {string} repoRoot - Repository root path.
 * @param {number} maxResults - Maximum results to return.
 * @param {string} mode - CQE mode (disabled|shadow|enabled).
 * @returns {Promise<{items:Array,total:number,returned:number,source:string,metadata:Object}>}
 */
async function retrieveWithCqe(queryText, repoRoot, maxResults, mode) {
  const { retrieveWithCqe } = await getCqeAdapter();
  const constraints = {
    repoRoot,
    mode,
    maxResults,
    registry: undefined, // Native WAM registry not used in this benchmark
    layers: [],
    lifecycle: [],
    admission: [],
    minScore: 0,
    requiredTerms: [],
    excludedIds: [],
  };
  return retrieveWithCqe(queryText, constraints);
}

/**
 * Run benchmark for a single query on both arms.
 * @param {Object} labeled - Labeled query object.
 * @param {string} corpusRoot - Corpus root path (fixture or self).
 * @param {number} k - Cutoff for precision/recall/ndcg.
 * @param {string} cqeMode - CQE mode (disabled|shadow|enabled).
 * @returns {Promise<Object>} Per-query results and metrics.
 */
async function evaluateQuery(labled, corpusRoot, k, cqeMode) {
  const { id, query, expected } = labled;

  // Arm A: Baseline (ripgrep/GitGrep)
  const armAResults = searchBaseline(query, { repoRoot: corpusRoot, maxResults: k });

  // Arm B: CQE (WAM+CQE)
  const cqeResult = await retrieveWithCqe(query, corpusRoot, k, cqeMode);
  const armBResults = (cqeResult.items || []).map(item => ({
    path: item.path,
    content: item.content,
    startLine: item.startLine,
    score: item.score ?? 1.0,
    tokenEstimate: item.tokenEstimate ?? Math.ceil((item.content?.length ?? 0) / 4),
  }));

  // Compute metrics per query
  const armAMetrics = computeQueryMetrics(armAResults, expected, k);
  const armBMetrics = computeQueryMetrics(armBResults, expected, k);
  const tokensA = tokensOf(armAResults);
  const tokensB = tokensOf(armBResults);

  return {
    id,
    query,
    type: labled.type,
    expected,
    tokensA,
    tokensB,
    armA: {
      results: armAResults,
      ...armAMetrics,
      tokensRetrieved: tokensA,
      metadata: {
        source: 'baseline',
        total: armAResults.length,
        empty: armAResults.length === 0,
      },
    },
    armB: {
      results: armBResults,
      ...armBMetrics,
      tokensRetrieved: tokensB,
      metadata: {
        source: cqeResult.source || 'cqe',
        total: cqeResult.total || 0,
        empty: cqeResult.total === 0 || cqeResult.fallbackUsed || false,
        fallbackUsed: cqeResult.fallbackUsed || false,
        cqeError: cqeResult.cqeError || null,
      },
    },
    delta: {
      recall: (armBMetrics.recall || 0) - (armAMetrics.recall || 0),
      precision: (armBMetrics.precision || 0) - (armAMetrics.precision || 0),
      mrr: (armBMetrics.mrr || 0) - (armAMetrics.mrr || 0),
      ndcg: (armBMetrics.ndcg || 0) - (armAMetrics.ndcg || 0),
    },
  };
}

/**
 * Run A/B comparison across all labeled queries for the selected corpus.
 * @param {string} corpusName - 'fixture' or 'self'.
 * @param {number} k - Cutoff for precision/recall/ndcg.
 * @param {string} outDir - Output directory for results.
 * @param {string} cqeMode - CQE mode (disabled|shadow|enabled).
 * @returns {Promise<Object>} Full benchmark results and aggregates.
 */
async function runBenchmark(corpusName, k, outDir, cqeMode = 'enabled') {
  const corpusRoot = CORPORA[corpusName];
  if (!corpusRoot) {
    throw new Error(`Unknown corpus: ${corpusName}`);
  }

  console.log(`Running A/B benchmark for corpus: ${corpusName} (k=${k})...`);

  const perQuery = [];
  for (const labled of LABELED_QUERIES) {
    console.log(`  Evaluating: ${labled.id}`);
    const result = await evaluateQuery(labled, corpusRoot, k, cqeMode);
    perQuery.push(result);
  }

  // Aggregate metrics per arm
  const perQueryRetrievedA = perQuery.map(q => q.armA.results);
  const perQueryRelevantA = perQuery.map(q => q.expected);
  const perQueryRetrievedB = perQuery.map(q => q.armB.results);
  const perQueryRelevantB = perQuery.map(q => q.expected);

  const armAMetrics = computeArmMetrics(perQueryRetrievedA, perQueryRelevantA, k);
  const armBMetrics = computeArmMetrics(perQueryRetrievedB, perQueryRelevantB, k);

  const tokenSavings = computeTokenSavings(
    perQuery.map(q => ({ armA: q.tokensA, armB: q.tokensB }))
  );
  const recallPerKToken = {
    armA: tokenSavings.totalBaselineTokens > 0 ? armAMetrics.recallMean / tokenSavings.totalBaselineTokens : 0,
    armB: tokenSavings.totalCQETokens > 0 ? armBMetrics.recallMean / tokenSavings.totalCQETokens : 0,
  };

  const aggregates = {
    armA: armAMetrics,
    armB: armBMetrics,
    tokenSavings,
    recallPerKToken,
    perQuery: perQuery,
    metadata: {
      corpus: corpusName,
      corpusRoot,
      k,
      cqeMode,
      timestamp: new Date().toISOString(),
    },
  };

  // Ensure output directory exists
  fs.mkdirSync(outDir, { recursive: true });

  // Write metrics.json
  const metricsPath = path.join(outDir, 'metrics.json');
  fs.writeFileSync(metricsPath, JSON.stringify(aggregates, null, 2), 'utf8');
  console.log(`  Written metrics to: ${metricsPath}`);

  // Write report.md
  const reportPath = path.join(outDir, 'report.md');
  const report = generateReport(aggregates);
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`  Written report to: ${reportPath}`);

  return aggregates;
}

/**
 * Generate markdown report from benchmark aggregates.
 * @param {Object} aggregates - Benchmark aggregates.
 * @returns {string} Markdown report.
 */
function generateReport(aggregates) {
  const { armA, armB, perQuery } = aggregates;
  const metricHeaders = ['Recall', 'Precision', 'MRR', 'NDCG', 'Coverage'];

  let md = '# A/B Benchmark Retrieval Report\n\n';
  md += `**Corpus:** ${aggregates.metadata.corpus} (root: ${aggregates.metadata.corpusRoot})\n`;
  md += `**k:** ${aggregates.metadata.k}\n`;
  md += `**CQE Mode:** ${aggregates.metadata.cqeMode}\n`;
  md += `**Timestamp:** ${aggregates.metadata.timestamp}\n\n`;

  md += '## Aggregate Metrics (mean ± stddev)\n\n';
  md += '| Metric | Arm A (Baseline) | Arm B (WAM+CQE) | Delta (B-A) |\n';
  md += '|--------|------------------|------------------|--------------|\n';
  for (const metric of metricHeaders) {
    const key = metric.toLowerCase();
    const aVal = armA[`${key}Mean`];
    const aStd = armA[`${key}StdDev`];
    const bVal = armB[`${key}Mean`];
    const bStd = armB[`${key}StdDev`];
    const delta = bVal - aVal;
    md += `| ${metric} | ${aVal.toFixed(4)} ± ${aStd.toFixed(4)} | ${bVal.toFixed(4)} ± ${bStd.toFixed(4)} | ${delta.toFixed(4)} |\n`;
  }
  md += `| Empty Rate | ${armA.emptyRate?.toFixed(4)} | ${armB.emptyRate?.toFixed(4)} | ${(armB.emptyRate - armA.emptyRate).toFixed(4)} |\n`;
  md += `| Dedup Rate | ${armA.dedupRate?.toFixed(4)} | ${armB.dedupRate?.toFixed(4)} | ${(armB.dedupRate - armA.dedupRate).toFixed(4)} |\n\n`;

  const ts = aggregates.tokenSavings;
  if (ts) {
    md += '## Token Cost (context injected)\n\n';
    md += '| Metric | Arm A (Baseline) | Arm B (WAM+CQE) |\n';
    md += '|--------|------------------|------------------|\n';
    md += `| Tokens retrieved | ${ts.totalBaselineTokens} | ${ts.totalCQETokens} |\n`;
    md += `| Tokens saved (B vs A) | — | ${ts.tokensSaved} (${ts.savingsPercent}%) |\n`;
    md += `| Recall / token | ${aggregates.recallPerKToken.armA.toFixed(6)} | ${aggregates.recallPerKToken.armB.toFixed(6)} |\n\n`;
    md += '- **Tokens retrieved**: sum of per-item token cost (CQE `token_estimate` when present, else content chars/4).\n';
    md += '- **Tokens saved**: Arm A tokens minus Arm B tokens; positive means CQE injects fewer tokens.\n\n';
  }

  md += '## Per-Query Details\n\n';
  md += '| Query ID | Query | Type | Arm A Recall | Arm B Recall | Delta | Arm A Tokens | Arm B Tokens |\n';
  md += '|----------|-------|------|---------------|---------------|-------|---------------|---------------|\n';
  for (const q of perQuery) {
    const delta = q.delta.recall;
    md += `| ${q.id} | \`${q.query}\` | ${q.type} | ${q.armA.recall?.toFixed(4) || 0} | ${q.armB.recall?.toFixed(4) || 0} | ${delta.toFixed(4)} | ${q.tokensA} | ${q.tokensB} |\n`;
  }

  md += '\n## Notes\n\n';
  md += '- **Arm A (Baseline)**: ripgrep/GitGrep file search, top-k.\n';
  md += '- **Arm B (WAM+CQE)**: adapter `src/context/cqe-adapter.js#retrieveWithCqe`.\n';
  md += '- **Delta**: Arm B minus Arm A (positive favors WAM+CQE).\n';
  md += '- All metrics computed with k cutoff as specified.\n';

  return md;
}

// CLI parsing
import { parseArgs } from 'node:util';
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    corpus: { type: 'string', default: 'fixture' },
    k: { type: 'string', default: '5' },
    out: { type: 'string', default: 'benchmarks/results/retrieval' },
    mode: { type: 'string', default: 'enabled' },
  },
});

(async () => {
  try {
    await runBenchmark(values.corpus, Number(values.k), values.out, values.mode);
    console.log('Benchmark completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Benchmark failed:', err);
    process.exit(1);
  }
})();
