import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { runCQP, runIntent, clearCache as globalClearCache } from './engine.js';
import { EvidenceEvaluator } from './evidence-evaluator.js';
import { QueryPlanner } from './query-planner.js';
import { Orchestrator } from './orchestrator.js';

function scopedBase(repoRoot) {
  const hash = crypto.createHash('sha1').update(repoRoot).digest('hex').slice(0, 12);
  return path.join(os.tmpdir(), 'context-query-core', hash);
}

export function createEngine(config = {}) {
  const repoRoot = path.resolve(config.repoRoot || config.root || process.cwd());
  const cacheDir = config.cacheDir ? path.resolve(config.cacheDir) : path.join(scopedBase(repoRoot), 'cache');
  const indexDir = config.indexDir ? path.resolve(config.indexDir) : path.join(scopedBase(repoRoot), 'index');
  const budget = config.budget || null;

  // No filesystem writes at construction time: creating an instance must not
  // modify the target repository or any other location.

  const evaluator = new EvidenceEvaluator({ repoRoot, cacheDir, indexDir });
  const planner = new QueryPlanner({ repoRoot, cacheDir, indexDir });
  const orchestrator = new Orchestrator({ repoRoot, cacheDir, indexDir, budget, evaluator, planner });

  return {
    repoRoot,
    cacheDir,
    indexDir,
    budget,
    evaluator,
    planner,
    orchestrator,
    createEngine: createEngine,
    async query(queryText, opts = {}) {
      const mergedOpts = {
        ...opts,
        root: repoRoot,
        repoRoot,
        cacheDir,
        indexDir,
        budget: opts.budget || budget,
      };

      const trimmed = String(queryText ?? '').trim();
      const isCqp = /^(FIND|SEARCH|SELECT|LIST)\b/i.test(trimmed);

      if (isCqp) {
        return runCQP(trimmed, mergedOpts);
      }
      return runIntent(trimmed, mergedOpts);
    },
    async runIterativeRetrieval(query, options = {}) {
      return orchestrator.runIterativeRetrieval(query, options);
    },
    clearCache() {
      globalClearCache();
      evaluator.clearCache();
      planner.clearCache();
      orchestrator.clearCache();
    },
    dispose() {
      // stateless: nothing to release
    },
  };
}

export { runCQP, runIntent };
export { EvidenceEvaluator, QueryPlanner, Orchestrator };

// Re-export commonly used functions for backwards compatibility
export { certaintyOf } from './evidence.js';
