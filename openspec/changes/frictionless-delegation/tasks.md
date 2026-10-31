# Tasks: Frictionless delegation

## 1. Delegation tools outside the risk envelope

- [x] Add `task` and `skill` to `OUT_OF_SCOPE_TOOLS` in
  `src/policy/action-capabilities.js` (keep `compress`, `delegate_task`, `call_agent`).
- [x] Assert both resolve to `SAFE` via `getEffectiveCapability`.

## 2. Advisory at the injection layer

- [x] In `index.js` `tool.execute.before`, detect the uncatalogued/fail-closed `BLOCKED`
  case and emit a `Recomendación` directive, then continue (no `RISK BLOCK`, no throw).
- [x] Keep known dangerous verbs on the existing soft/strict path (`WAM_STRICT_BLOCK`).

## 3. Default parallel delegation with right-sized context

- [x] Rewrite `prompts/injections/delegation.md`: non-blocking default, delegate each
  independent pending req in parallel, pass only req + domain/files + acceptance,
  never full history, keep trivial tasks inline, inline mutation allowed.
- [x] Keep `delegation-item.md` / `delegation-overflow.md` literal shape (no per-item
  context repetition).

## 4. Tests

- [x] Update `src/prompts/characterization.test.mjs` literal for
  `injection.delegation`.
- [x] Extend `src/policy/zero-friction.test.mjs`: `task`/`skill` not blocked; unknown
  tool advisory; hard delete blocked.
- [x] Keep `tests/unit/risk-engine.test.mjs` (UNKNOWN → BLOCKED for project tools) and
  `tests/unit/action-capabilities-mcp.test.mjs` green.

## 5. Validation

- [x] `openspec validate --changes --strict`
- [x] `npm run build` and load-check `dist/`
- [x] `node --test --test-force-exit` on the affected suites
