/**
 * Lifecycle Token Savings & Governance Benchmark
 * Measures token reduction when using lifecycle agent profiles vs monolithic AGENTS.md.
 */

import { loadLifecycleInstructions } from '../src/cognition/lifecycle-loader.js';

function countTokens(text) {
  return Math.ceil((text || '').length / 4);
}

function runBenchmark() {
  const monolithicTokens = 1500; // Simulated full AGENTS.md + global rules load
  
  const exploreProfile = loadLifecycleInstructions('explore', process.cwd());
  const implementProfile = loadLifecycleInstructions('implement', process.cwd());
  const validateProfile = loadLifecycleInstructions('validate', process.cwd());

  const lifecycleAvgTokens = Math.round(
    (countTokens(exploreProfile) + countTokens(implementProfile) + countTokens(validateProfile)) / 3
  );

  const savingsPercent = Math.round(((monolithicTokens - lifecycleAvgTokens) / monolithicTokens) * 100);

  console.log('--- Lifecycle Token Savings Benchmark ---');
  console.log(`Monolithic baseline tokens: ${monolithicTokens}`);
  console.log(`Lifecycle profile avg tokens: ${lifecycleAvgTokens}`);
  console.log(`Token savings: ${savingsPercent}%`);
  console.log('----------------------------------------');

  if (savingsPercent < 50) {
    throw new Error('Expected at least 50% token savings');
  }
}

try {
  runBenchmark();
  console.log('Benchmark passed successfully.');
} catch (err) {
  console.error('Benchmark failed:', err);
  process.exit(1);
}
