---
name: verify
description: "Evidence-backed verification before completion. Use when the user asks to verify, validate, test, or confirm work, or before claiming DONE, fixed, working, completed, or ready. Maps each mandatory criterion to an observable check and refuses completion while the runtime gate has pending work."
tools: [read, search, bash]
user-invocable: true
argument-hint: "Task, requirement, or completion claim to verify"
---

# Verify

The implementation is not the result. The executed check is not the result. The
result is the observed evidence that the acceptance criterion is satisfied.

A completion claim is allowed only after the runtime completion gate reports no
pending work. The gate is authoritative; this skill is the procedure that
produces the state the gate evaluates.

## Activation boundary

Use this skill when:

- the user asks to verify, validate, test, check, or confirm work;
- you are about to say `DONE`, `COMPLETED`, `FIXED`, `working`, `solved`,
  `ready`, or an equivalent in any language;
- a task has acceptance criteria, an outcome contract, or a definition of done.

Do not use it for exploratory reading, speculative design, or casual
conversation with no completion decision.

## Runtime invariants

These are non-negotiable. A failure in any invariant means: do not claim
completion.

| ID | Invariant | What blocks completion |
| --- | --- | --- |
| V1 | Fail-closed | Missing, malformed, unknown, or ambiguous state |
| V2 | Decisions resolved | Blocking unknown or unresolved `DECISION_CRITICAL` assumption |
| V3 | Requirements closed | Any mandatory requirement not verified, or verified without evidence |
| V4 | Evidence provenance | Cross-session, stale, expired, or unsupported-by-source evidence |
| V5 | No contradictions | Supporting and contradicting evidence for the same requirement |
| V6 | Sufficient strength | Critical requirement without direct evidence; non-critical without observation |
| V7 | No pending backlog | Any backlog item still `pending` |
| V8 | Contract satisfied | Completion criterion `FAIL`/`UNKNOWN`, missing outcome contract, or outcome not `ACHIEVED` |
| V9 | Legal state | Any transition to `COMPLETED` other than from `VERIFYING` |
| V10 | Craftsman review | A code change not audited against the `craftsman` Diff Audit (KISS, DRY, clean) |

Optional requirements never block completion. They may be reported as
limitations, but they are not completion criteria.

The runtime implementation is:

- `src/integration/orchestration.js` — `evaluateCompletionGate`;
- `src/verification/completion-invariants.js` — structured evidence checks;
- `src/verification/verification-lifecycle.js` — requirement verification and
  outstanding work;
- `src/execution/execution-state.js` — legal state transitions;
- `src/quality/task-quality-contract.js` — strength, freshness, contradiction.

Do not reimplement these rules in prose or claim a stronger guarantee than the
gate reports.

## Procedure

### 1. Establish the contract

Read the task state and list the mandatory acceptance criteria. For each
criterion, name the observable result that proves it. If a criterion has no
observable check, say so and do not claim it as verified.

Do not infer criteria from the implementation. The contract, outcome contract,
and requirement list are the only sources of completion criteria.

### 2. Map criterion to check

Choose the cheapest check that produces sufficient evidence:

1. existing automated test;
2. targeted command;
3. targeted inspection;
4. minimal reproduction;
5. broader test suite.

Every check must identify what it proves and what it does not prove. A passing
build is not proof of runtime behavior. A file existing is not proof that it is
imported or executed.

### 3. Execute the check

Run the check. Record:

- the exact command or inspection;
- the observed result;
- the scope and limitations;
- the source or artifact the evidence refers to;
- when it was observed.

If the environment prevents the check, record the block. A blocked check is not
a success, and it is not evidence against the implementation.

### 4. Record evidence

Evidence must be traceable to the criterion it supports. Prefer direct or
verification evidence over inference. Never use:

- the change itself as proof that the change works;
- the absence of an error as proof of correctness;
- an unrelated passing test as proof of this criterion;
- a previous session's observation for the current task;
- a stale observation after the source changed.

Do not mark a requirement verified yourself. Record the evidence through the
normal task-state path so the runtime can evaluate it.

### 5. Craftsman review of the diff

When the task changed code, audit the diff against the `craftsman` skill's
**Diff Audit** before claiming completion. The review is part of "done", not an
optional polish pass:

- no unjustified 1:1 abstractions or speculative interfaces (RUNG-1, RUNG-5);
- no copy-paste duplication that should share one reason to change (DRY), and no
  needless files, layers or machinery (KISS);
- readable, cohesive, clearly named code with valid domain states;
- errors preserve their original cause; no silently swallowed failures;
- existing contracts and tests still hold.

Record which files were reviewed and any accepted exception as evidence. A diff
that fails the audit is not done, even when its tests pass.

### 6. Ask the gate

Call or observe the runtime completion gate. If it reports `pending`, those items
are the remaining work. Do not claim completion. Report:

- what is verified;
- what is pending;
- the evidence that would resolve each pending item;
- any environmental limitation.

If `completionGate.enforce` is off, the runtime is advisory. The skill is still
binding: do not use the advisory downgrade as permission to claim DONE.

### 7. Claim completion

Claim completion only when:

- every mandatory invariant passes;
- the code diff passed the Craftsman review (or the task changed no code);
- the gate reports `allDone` or an empty pending set;
- the task is in `VERIFYING` and can legally transition to `COMPLETED`.

State the evidence directly. Do not say "should work", "looks correct", or
"tests pass" without naming the check and result.

## Failure handling

When a check fails:

1. record the failure and its cause;
2. keep the requirement unverified;
3. fix the cause or report the block;
4. re-run the check before claiming completion.

Never convert a timeout, missing dependency, flaky run, or partial output into a
pass. A retry is allowed only when it produces a new observation, not to hide a
consistent failure.

## Output contract

When verification is incomplete, return:

```text
Verified:
- <criterion>: <check> -> <observed result>

Pending:
- <criterion>: <what is missing> -> <evidence that would resolve it>

Limitations:
- <environment or scope limitation>

Status: NOT DONE
```

When verification is complete, return the same evidence summary and then the
completion claim. The claim must be supported by the listed evidence.

## Anti-patterns

- Declaring DONE because the code was written, without a Craftsman review.
- Treating a successful command as proof of every criterion.
- Using another session's evidence.
- Accepting stale evidence after editing the source.
- Ignoring contradicting observations.
- Marking optional criteria as blockers, or optional failures as success.
- Bypassing the gate because enforcement is advisory.
