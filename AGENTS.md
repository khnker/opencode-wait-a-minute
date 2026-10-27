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
npm run build                 # copy src/skills/prompts to dist
npm run validate              # release gate (full suite; slow)
node scripts/run-tests.mjs    # full suite with force-exit
node scripts/prune-wam-artifacts.mjs --apply  # archive one-use test tasks/snapshots
```

## Runtime notes

- Logging is opt-in for this repo: `.wam/config.json` sets `"logging": false`.
- `WAM_LOGGING=true` enables logs; `plugin.log` rotates at 5 MB.
- Tests must not write to the project `.wam`; the test runner disables logging and
  redirects `WAM_LOG_FILE` to the OS temp directory.
- `/wam off` bypasses WAM for the current session; `/wam on` restores it.

## Design rules

- Deterministic fallbacks first; LLM/embedding dependencies are optional, never required.
- Validate at trust boundaries; fail loud on corrupt state, fail soft on diagnostics.
- Keep user prompts immutable; injected context is synthetic and tagged.
- Prefer bounded structures (logs, recent changes, memory) over unbounded growth.
