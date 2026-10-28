# AGENTS.md — wait-a-minute-plugin

## Mandatory change workflow

Every non-trivial change follows this order:

1. **Research**: search current best practices (official docs, papers, vendor docs) for the problem.
2. **Evaluate alternatives**: record at least two options, the chosen one and why the others were rejected.
3. **Spec first**: create/update an OpenSpec change under `openspec/changes/<change>/` with
   `proposal.md`, `design.md` (including the research links and alternatives), `tasks.md`
   and `specs/<capability>/spec.md`.
4. **Implement**: keep the smallest complete diff; no dead code, no unrequested abstractions.
5. **Test**: add regression tests for new behavior; run affected suites with
   `node --test --test-force-exit <files>`.
6. **Validate**: `openspec validate --changes --strict`, `npm run build`, and load-check `dist/`.
7. **Report**: files changed, tests run, residual risks.

## Project commands

```bash
npm run build                 # copy index.js, package.json, src/, skills/, prompts/, vendor/ to dist (POSIX cp)
npm run validate              # release gate (full suite; slow)
node scripts/run-tests.mjs    # full suite with force-exit
node scripts/prune-wam-artifacts.mjs --apply  # archive one-use test tasks/snapshots
```

Prerequisites: Node >= 20 and the sibling `../context-query-core` checkout
(`context-query-core` is a `file:` dependency).

Tests live in `tests/` (legacy, e2e, isolation), as `test-*.mjs` at the repo root and as
`src/**/*.test.js`. Per-file runs use `node --test --test-force-exit <files>`.

## Runtime notes

- Logging is opt-in for this repo: `.wam/config.json` sets `"logging": false`.
- `WAM_LOGGING=true` enables logs; `plugin.log` rotates at 5 MB.
- Tests must not write to the project `.wam`; the test runner disables logging and
  redirects `WAM_LOG_FILE`, `WAM_METRICS_DIR` and `WAM_SESSION_DIR` to the OS temp directory.
- To run the suite while a live WAM session uses the project, use
  `node scripts/run-tests-isolated.mjs` (throwaway copy with its own `.wam`).
- `/wam off` bypasses WAM for the current session; `/wam on` restores it.

## Design rules

- Deterministic fallbacks first; LLM/embedding dependencies are optional, never required.
- Validate at trust boundaries; fail loud on corrupt state, fail soft on diagnostics.
- Keep user prompts immutable; injected context is synthetic and tagged.
- Prefer bounded structures (logs, recent changes, memory) over unbounded growth.

## Delegation rules

- Independent work runs in parallel subagents, never serialized in the orchestrator.
- Search, exploration and any read-only lookup go to the fast tier.
- Coding goes to the tier that matches the diff: trivial edits and file reads to the fast
  tier, multi-file or logic changes to the medium tier; heavy only for architecture and
  deep debugging.
- Sequential only when a step depends on another step's output.
