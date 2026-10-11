# WAM Context Governance Optimization — Start

## Change Entry Point

This change introduces context governance optimizations into WAM runtime: pre-flight context caching, historical case benchmarking, trigram index warm-up, and context compression.

## Current State (Analysis of Conversations and Iterations)

### Observed Pattern
Every new conversation repeats heavy governance reads:
- `AGENTS.md` global (~3000 tokens)
- Repository `AGENTS.md` per project
- Large prompt instructions and rules
- Redundant searches for tools and states

### Root Cause
No centralized caching layer — each agent session re-reads governance files and re-indexes search tools from scratch.

### Evidence from Recent Iterations
- 5 WAM changes required `openspec validate` + `node scripts/run-tests.mjs` each time
- Benchmarks were wired multiple times across repos
- No historical case lookup during task planning

## What This Change Adds

| Component | Location | Purpose |
|-----------|----------|---------|
| GovernanceCache | `src/context/governance-cache.js` | Cache AGENTS.md distillation ≤ 200 tokens |
| HistoryStore | `src/context/history-store.js` | Index git log + openspec archive, match patterns |
| IndexManager | `src/context/index-manager.js` | Warm `tgrep` index, avoid cold start |
| Context Compression | Runtime guard hook | Trigger at 50% capacity |

## How to Start

```bash
# 1. Enter the change in OpenSpec
openspec status --change wam-context-governance-optimization

# 2. Validate the change spec
openspec validate wam-context-governance-optimization --strict

# 3. Run implementation tasks T-01 → T-05 sequentially
# 4. Verify: full test suite 0 fail, openspec strict pass
node scripts/run-tests.mjs
openspec validate --all --strict
```

## Acceptance Criteria
- Initial token overhead reduced ≥ 40%
- Historical case lookup < 100ms
- Zero cold-start search penalty
- Compression at threshold

## Related
- `openspec/changes/wam-context-governance-optimization/specs/.../spec.md`
- `openspec/changes/wam-context-governance-optimization/design.md`
- `openspec/changes/wam-context-governance-optimization/tasks.md`
