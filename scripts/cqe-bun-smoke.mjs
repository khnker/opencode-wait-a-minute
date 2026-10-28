/**
 * Bun smoke test for the CQE worker runtime.
 * Run with: bun scripts/cqe-bun-smoke.mjs
 */
import process from 'node:process';
import { retrieveWithCqe } from '../src/context/cqe-adapter.js';

const result = await retrieveWithCqe('FIND definitions OF symbol parseConfig', {
  repoRoot: process.cwd(),
  mode: 'enabled',
  timeoutMs: 20000,
});

const items = result.items?.length ?? 0;
console.log(`BUN_CQE_OK source=${result.source} items=${items}`);
process.exit(result.source === 'cqe' ? 0 : 1);
