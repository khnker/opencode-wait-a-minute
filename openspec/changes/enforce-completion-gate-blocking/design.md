# Design — Enforce and Surface Completion-Gate Blocking

## Research

- ISO/IEC 25010 quality model — completion criteria must be explicit per task,
  not inferred from the claim: https://iso25000.com/index.php/en/iso-25000-standards/iso-25010
- ACM Artifact Review and Badging v1.1 — a result is only accepted when the
  evidence is available and verifiable: https://www.acm.org/publications/policies/artifact-review-and-badging-current
- Scrum "Definition of Done" — a shared, checkable exit condition prevents
  nominal completion: https://www.scrum.org/resources/what-definition-done
- OpenSpec change workflow in this repository (`AGENTS.md`): research,
  alternatives, spec, smallest diff, regression tests, validate.

## Decision

Add an explicit, opt-in enforcement flag (`completionGate.enforce`) and keep the
existing default advisory path untouched.

When `enforce` is true the public wrapper:

1. Runs the strict gate exactly as today.
2. Merges quality-contract reasons (when `qualityContracts.enabled`).
3. Returns `blocked: true`, `advisory: false`, `ok: false` and the merged
   `pending` list.

When `enforce` is false the wrapper reproduces the current behavior: a blocked
verdict becomes `blocked: false, advisory: true`, with the same recommendation.

The chat handler and `buildCompletionValidation` switch on the verdict: a
blocked gate produces a directive message, an advisory gate keeps the current
"recommendation" wording.

## Alternatives considered

1. **Flip the global default to hard blocking.**
   Rejected: the archived `enforce-task-specific-quality-contracts` design
   requires no default behavior change while the flag is off; a hard default
   would break the zero-friction contract and dozens of advisory-asserting
   tests, and would block legitimate conversational follow-ups.
2. **Keep the advisory-only wrapper and only improve wording.**
   Rejected: it leaves the strict verdict unreachable from chat and from the
   task loop, so the production exit condition is never enforced.
3. **Enforce inside the task loop only.**
   Rejected as the primary fix: a blocked DONE would still be accepted in the
   chat path, and the user would not see why.
4. **Per-requirement policy (block some, warn others).**
   Deferred: it adds configuration surface before the simple opt-in is proven;
   the `pending` reasons already let a caller decide later.

## Data flow

```
loadWamConfig -> completionGate.enforce
  -> index.js (plugin config + task-loop dispatch + auto-continuation)
  -> message-handler (evaluateCompletionGate + notice injection)
  -> session-driver.driveTaskLoop (evaluateGate + persisted event)
```

`evaluateCompletionGate` stays pure: it reads only `state`, `promptText`,
`options.quality` and `options.enforce`.

## Risks

- Enabling the flag in a project with imported, unverified historical tasks can
  block on legitimate work. Mitigation: the flag is per project and off by
  default; the pending list names every missing reason.
- Duplicated reasons when both the strict gate and the quality contract report
  the same gap. Mitigation: merge by string identity before returning.
- The auto-loop could re-drive forever. Mitigation: existing caps in
  `src/execution/auto-continuation.js` are unchanged; a blocked gate is not
  `allDone`, so the plan keeps the existing per-set and total caps.

## Validation evidence (real opencode web, 2026-11-04)

`opencode web` was run against a project with `completionGate.enforce: true`
and a persisted task (`demo-gate`) whose two requirements were still `pending`.
Claiming `DONE` in the web composer produced, in the persisted user-message
parts (fetched from `/session/<id>/message`):

- one `⛔ [wait-a-minute] Completitud bloqueada ... No declares DONE` part;
- zero `Recomendación: faltan` parts and zero `procedo` instructions;
- task state still `IMPLEMENTING` with both requirements `pending` and
  `completionGateKey` persisted.

The first run also exposed a contradiction: the legacy advisory part
(`⚠️ ... procedo`) was emitted *in addition to* the block. The handler now
emits the advisory only when the gate is advisory, and in enforce mode it
re-injects the block on every repeated `DONE` (the de-duplication still
applies to advisory notices). The regression test in
`tests/unit/completion-gate-validation.test.mjs` covers both points.

### Follow-up defect: the allowed DONE never completed (fixed)

A second real run with a fully verified task (`demo-done`) exposed the opposite
path: `DONE` returned early through the continuation fast-path and the task
stayed `IMPLEMENTING`. `message-handler.js` treated `claim.allDone === true` as
a continuation, so a legitimate completion never reached
`applyPhaseTransition`/`confirmCompletion`.

Fix: the fast-path now applies only to **non-DONE** prompts
(`const isContinuation = !isDoneClaim`). Every DONE claim falls through to the
gate, which decides block, advise, or complete. Regression test:
`test/message-handler.test.mjs` — "DONE con contrato APPROVED y todo verificado
no toma el fast-path y completa".

Re-verified in the web UI:

- `demo-gate` + `DONE` → only the `⛔ Completitud bloqueada` part; phase stays
  `IMPLEMENTING` with both requirements `pending`.
- `demo-done` + `DONE` → completion notice, phase `DONE`, `lastAction: DONE`.

## Residual risk (observed, not addressed here)

User-facing WAM parts (the `⛔` block and the `✅ Tarea completada` notice) are
emitted with `synthetic: true`; opencode web does not render synthetic user
parts, so the operator sees neither message directly. The model still receives
them and may relay them, but the guarantee is indirect. Separating
"visible notice" from "hidden injected context" is a follow-up change, not part
of this gate-enforcement change.
