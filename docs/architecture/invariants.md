# High-Risk Invariants

Status: first pass (RC1 pre-work, change 3 of 5)
Date: 2026-10-05

Documented from implementation; every claim below is anchored to a module. These are
the behaviors that MUST NOT regress.

## 1. Execution State Machine

Source: `src/execution-state.js`.

States: `INITIALIZING`, `INVESTIGATING`, `EXECUTING`, `VERIFYING`, `COMPLETED`,
`BLOCKED`, `WAITING_AUTHORIZATION`, `FAILED`.

Legal transitions (strict; anything else throws):

| From | To |
|---|---|
| INITIALIZING | INVESTIGATING, BLOCKED |
| INVESTIGATING | EXECUTING, WAITING_AUTHORIZATION, BLOCKED |
| EXECUTING | VERIFYING, BLOCKED, FAILED |
| VERIFYING | COMPLETED, EXECUTING, FAILED |
| WAITING_AUTHORIZATION | EXECUTING, BLOCKED |
| BLOCKED | INVESTIGATING, EXECUTING |
| FAILED | INVESTIGATING |
| COMPLETED | (terminal — none) |

Invariants:
- `COMPLETED` is terminal.
- Transitioning to `COMPLETED` throws while `hasOutstandingWork(taskState)` is true
  (unverified requirements or pending backlog). Fail-closed.
- Invalid state strings throw (`validateState`).
- Legacy phases map via `migrateLegacyPhase`; unknown phases default to `INITIALIZING`.

## 2. Policy State Machine

Source: `src/policy-state-machine.js`.

- `POLICY_CHAIN` order: SCOPE → INVESTIGATE → ACTION → DEBUG → OBSERVE → VERIFY →
  REVIEW → COMPLETION.
- `validatePolicyFlow` rejects same-policy and transitions not in `POLICY_TRANSITIONS`.
- `getNextPolicy` returns `null` at the end of the chain.
- `POLICY_PRECONDITIONS` gate entry to each policy via `checkPolicyPreconditions`.

Note: `src/verification-policy.js` also exports `validatePolicyFlow`/`getNextPolicy`,
but over `VERIFICATION_STRATEGY` (a different domain). Do not conflate the two.

## 3. Context Levels N0–N3

Sources: `src/verification-context.js`, `src/assembly.js`.

| Level | Meaning | Pack class |
|---|---|---|
| N0 | Global / policy / task requirements | MANDATORY, tiny |
| N1 | Domain-specific verification knowledge | CONDITIONAL, selective |
| N2 | Current task state, evidence, observations | MANDATORY (live) |
| N3 | Opportunistic / session capsules | OPTIONAL |

Invariants:
- **N3 MUST NOT substitute missing N2 evidence.** `validateContextBudget` emits
  `"N3 context used to substitute missing N2"` when N3 is present without N2.
- Required levels that are absent make the budget invalid (`valid: false`).
- Individually-rendered requirement capsules in N3 are capped (`assembly.js`).

## 4. Completion / Verification Gate (fail-closed)

Source: `src/verification-policy.js#evaluateCompletionGate`.

Invariants:
- A task is `blocked` unless EVERY mandatory (non-optional) requirement is
  `VERIFIED` AND there are no evidence gaps.
- Missing/malformed evidence never passes: absent requirements/evidence default to
  empty arrays, which blocks completion.
- Optional requirements do not affect `blocked`.

Related: `src/orchestration.js#evaluateCompletionGate(state, promptText)` is a pure
prompt/state gate. It auto-approves continuation prompts (`"continuar"`,
`"aprobar contrato"`) and otherwise only evaluates when a done-claim is detected;
blocking unknowns and pending work block it. It has no side effects.

## 5. Evidence Semantics

Source: `src/evidence.js`.

- Types (`EVIDENCE_TYPES`): DIRECT, DERIVED, INFERRED, NEGATIVE, ENVIRONMENT,
  TOOL_OUTPUT, TEST_RESULT, USER_CONFIRMATION.
- Strength (`EVIDENCE_STRENGTH`): L0_CLAIM < L1_INFERENCE < L2_OBSERVATION <
  L3_DIRECT < L4_VERIFICATION.
- Conflicting evidence (one supports, one contradicts) resolves to `UNKNOWN`; it is
  never silently treated as support.
- Default strength for a new evidence item is L2_OBSERVATION.

## 6. Continuation Fast-Path Constraints

Source: `src/orchestration.js`.

- The fast-path only fires for explicit continuation/approval prompts.
- It returns `autoApprove: true` with `blocked: false`; it does NOT mark a task done.
- A done-claim without supporting state still returns `blocked: true` when blocking
  unknowns or pending work exist.

## 7. Persistence / Recovery

Sources: `src/persistence-manager.js`, `src/task-runs.js`, `.wam/`.

- Runtime task state lives under `.wam/` (`task-state.json`) and is untracked
  (see change `rc1-22-wam-runtime-state-isolation`).
- Task runs are append-only records: `addObservation`/`addDecision`/`addEvidence`
  push a new item with a monotonic id and timestamp; they never mutate prior items.
- A missing run file throws `Run <id> not found` rather than silently creating one.
- Recovery reads the latest run; it must not fabricate state.

## 8. OpenCode Integration Boundaries

- Runtime adapters own host interaction (`src/router-adapter.js`, runtime adapters).
- Pillars must not import orchestration; `shared` must not import domain pillars
  (see `wam-architecture-taxonomy`).
- No network in runtime skill loading: the skill catalogue is build-time embedded.

## 9. Fail-Closed Summary

| Situation | Behavior |
|---|---|
| Outstanding work + transition to COMPLETED | throw |
| Illegal state transition | throw |
| Mandatory requirement unverified | gate `blocked` |
| N3 present without N2 | budget warning |
| Conflicting evidence | `UNKNOWN` |
| Missing run file | throw |
