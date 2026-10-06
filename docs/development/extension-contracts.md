# Extension Contracts

Status: first pass (RC1 pre-work, change 2 of 5)
Date: 2026-10-05

This document is the contract catalogue for adding new capabilities to WAM without
modifying unrelated domain logic. For each extension point it states the contract
(input, output, failure, lifecycle, side effects, ownership, registration, ordering)
and the extension workflow.

## Extension Point Catalogue

### EP1 — Capability / skill registration

- **Owner**: skills pillar (`src/skills/engine.js`).
- **Input**: `availableSkills` — an object keyed by skill name. Each entry MAY be
  `{}`, `{ path }`, or `{ path, metadata }`.
  `metadata` MAY contain `capabilities`, `triggers`, `keywords`, `domain`, `risk`.
- **Output**: `buildRegistry(availableSkills, baseDir)` →
  `{ registry, corpusRoot, sources, registryFile }`; each registry entry is
  `{ id, name, source, capabilities, triggers, risk, compatibility, status: "APPROVED", cache }`.
- **Failure**: invalid entries are skipped; `buildRegistry` never throws for missing
  `availableSkills`. `loadBundledRegistry` swallows malformed `skills/registry.json`.
- **Lifecycle**: discovery → registration (`APPROVED`) → routing → on-demand content load.
- **Side effects**: none at registration time (no network, no disk writes).
- **Registration**: pass the capability in `availableSkills`. Metadata under
  `metadata` overrides hardcoded builtins. **No edit to `engine.js` is required.**
- **Ordering**: registration MUST precede routing; routing MUST precede content load.

### EP2 — Skill routing / scoring

- **Owner**: skills pillar (`routeSkillsV2`, `scoreSkill`).
- **Input**: `routeSkillsV2(prompt, projectInfo, registry, mode, options)`.
- **Output**: ordered selection with rejected candidates + reasons.
- **Failure**: non-`APPROVED` entries are rejected, not thrown.
- **Side effects**: writes a context decision trace under the task root.
- **Registration**: a capability becomes routable by supplying `metadata.capabilities`
  and/or `metadata.keywords`/`metadata.domain` at registration (EP1).
- **Ordering**: must run against a registry produced by EP1.

### EP3 — Context strategies (benchmark / evaluation)

- **Owner**: context pillar (`src/context/context-evaluation.js`, `src/context/context-routing-evaluation.js`).
- **Input**: a benchmark scenario (`{ name, setup(graph) }`).
- **Output**: `{ strategy, ...metrics }` per strategy.
- **Failure**: a strategy that throws fails its own row; it does not abort the run.
- **Registration**: strategy list is currently local to `runScenario` — adding a
  strategy still requires editing the harness. **Known gap** (see Unresolved).
- **Ordering**: scenario setup before strategy execution.

### EP4 — Verification validators / completion gate

- **Owner**: verification pillar (`src/verification/verification-policy.js`,
  `src/verification/verification-model.js`, `src/evidence/evidence.js`).
- **Input**: task state / evidence records.
- **Output**: gate decision + reasons; state transitions.
- **Failure**: unknown state → rejected/UNKNOWN, never silently passes.
- **Registration**: validators are selected by state machine, not a plugin registry.
- **Ordering**: evidence before gate; gate before completion.

### EP5 — Policy state machine

- **Owner**: preflight/policy (`src/policy/policy-state-machine.js`).
- **Input**: current policy state + event.
- **Output**: next state or rejection.
- **Failure**: illegal transition is rejected.
- **Registration**: transitions are declared in-module (intrinsic algorithm).

### EP6 — Execution state transitions

- **Owner**: execution pillar (`src/execution/execution-state.js`).
- **Input**: `(from, to, taskState)`.
- **Output**: validated transition.
- **Failure**: illegal transition rejected.
- **Registration**: transition table is intrinsic to the algorithm.

## Extension Workflow (adding a capability)

1. Choose the extension point (usually EP1).
2. Implement the contract (input/output/failure).
3. Register it: add the skill entry with `metadata` (EP1). No edits to unrelated
   orchestration or domain modules.
4. Add focused tests next to the capability.
5. Run the existing validation suite (`npm test`).
6. If the capability needs routing, declare `metadata.capabilities`/`keywords`.
7. If it needs content load, provide the bundled catalogue entry.

## Representative Fixture

`tests/unit/extensibility-contracts.test.mjs` registers a brand-new capability
through `buildRegistry` using only injected metadata and asserts it is registered
and routable, without modifying `engine.js` beyond the one-time EP1 contract.

## Unresolved

- EP3 strategy list is not yet a registration mechanism (harness-local array).
  Tracked as a follow-up; not required to add a production capability.
- Routing metadata for the bundled catalogue (`skills/registry.json`) is not yet
  projected into `capabilities`/`keywords`; entries rely on the builtin table.
