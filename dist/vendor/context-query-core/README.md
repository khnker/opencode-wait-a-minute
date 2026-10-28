# Context Query Core (cqe-core)

A cost-aware, robust context query engine core extracted for AI agents and codebases.

## Overview

`cqe-core` treats agent context retrieval as a query optimization problem instead of naive full-repo grepping.

## What It Is Used For

`cqe-core` is designed for AI agents and developer tools that need to retrieve precise, high-signal context from large codebases while strictly respecting token budgets, avoiding redundant searches, and maintaining absolute provenance over every retrieved snippet.

## Tools Used

- **`tgrep`**: Ultra-fast trigram-indexed regular expression search for raw text matching.
- **`ast-grep` (`sg`)**: Abstract Syntax Tree (AST) search for structural and semantic code patterns.
- **`bm25`**: Lexical scoring and term-frequency retrieval.
- **Federated Knowledge Graph**: Structured metadata retrieval for services, dependencies, and decisions.

## Workflow

1. **Query Parsing (CQP)**: The agent expresses what it needs in declarative query syntax.
2. **Intent Detection**: The engine classifies the query type (definitions, references, implementation, pattern, concept).
3. **Hybrid Retrieval Plan**: The planner dispatches tasks across available tools (`tgrep`, `bm25`, symbol lookup, federated graph) in parallel or sequence.
4. **Candidate Fusion & Reranking**: Results are deduplicated, scored, and filtered.
5. **Budget-Aware Selection**: Candidates are packed into the target token budget.
6. **Provenance Tracking**: Every result retains metadata on source operator, query, and confidence.

## Installation & Usage

```javascript
import { createEngine } from './src/core.js';

const engine = createEngine({ repoRoot: process.cwd() });
const results = await engine.query({ query: 'find authentication middleware' });

// Or use iterative retrieval with multiple strategies
const iterativeResults = await engine.runIterativeRetrieval(
  'find authentication middleware',
  {
    mode: 'deterministic', // deterministic or shadow
    budget: 8000,         // token budget
    maxIterations: 3,     // max iterations
    threshold: 0.7        // confidence threshold
  }
);

// Access individual components
const { EvidenceEvaluator, QueryPlanner, Orchestrator } = await import('./src/index.js');

// Create specialized instances
evidenceEvaluator = new EvidenceEvaluator({ repoRoot, cacheDir, indexDir });
queryPlanner = new QueryPlanner({ repoRoot, cacheDir, indexDir });
orchestrator = new Orchestrator({ repoRoot, cacheDir, indexDir, budget, evaluator, planner });
```

## API Reference

### Core Engine

**`createEngine(config)`** - Create a new CQE engine instance
- `config.repoRoot`: Root directory of the repository
- `config.budget`: Token budget for retrieval
- `config.cacheDir`: Directory for cache files
- `config.indexDir`: Directory for index files

**`engine.query(queryText, options)`** - Execute a single query
- `options.root`: Repository root (defaults to engine.repoRoot)
- `options.budget`: Token budget override
- Supports both CQP (declarative) and natural language queries

**`engine.runIterativeRetrieval(query, options)`** - Execute iterative retrieval with multiple strategies
- `options.mode`: Retrieval mode ('deterministic', 'shadow')
- `options.maxIterations`: Maximum number of iterations
- `options.threshold`: Confidence threshold for stopping
- `options.eliminateDuplicates`: Whether to eliminate duplicate results
- `options.enableShadowMode`: Enable shadow retrieval mode

### Components

**`EvidenceEvaluator`** - Evaluates evidence packets and computes coverage metrics
- `evaluate(criteria, evidence)` - Evaluate evidence against criteria
- `computeConfidence(evidence)` - Compute average confidence score
- `validateEvidence(evidence, thresholds)` - Validate evidence against thresholds

**`QueryPlanner`** - Plans retrieval strategies and detects intent
- `plan(query, options)` - Create a retrieval plan
- `detectIntent(query)` - Detect query intent (deterministic)
- `validatePlan(plan)` - Validate a retrieval plan
- `generateSuggestions(query)` - Generate query suggestions
- `improveQuery(query, context)` - Improve query based on context

**`Orchestrator`** - Manages iterative retrieval workflows
- `runIterativeRetrieval(query, options)` - Run iterative retrieval
- Supports deterministic and shadow modes
- Handles budgets, iterations, duplicates, and terminal states

### Utility Functions

**`certaintyOf(matchType)`** - Get certainty score for evidence match type
**`runCQP(query, options)`** - Run CQP (declarative) query
**`runIntent(query, options)`** - Run intent-based query

## Benchmark Framework

Run benchmarks to compare strategies:

```bash
node benchmarks/cqe-benchmark.mjs
```

The benchmark compares three strategies:
- **A**: Single-pass deterministic
- **B**: Iterative deterministic
- **HY**: Hybrid lexical+structural

Metrics: Recall, Precision, MRR, nDCG, latency p50/p95

## Testing

Run the test suite:

```bash
npm test
```

All tests should pass successfully.

## License

MIT

## Version

1.0.0