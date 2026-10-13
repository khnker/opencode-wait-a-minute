# Design: strengthen-prompt-behavior-oracles

## Context

`evaluateCriterion` currently does `output.toLowerCase().includes(check.toLowerCase())`.
The suite `check` strings are prose descriptions of intent, so the oracle is
both too strict (fails valid paraphrases) and too weak (passes any text that
echoes the sentence). Change 01 wired real execution; this change makes the
per-criterion signal meaningful.

## Goals / Non-Goals

**Goals:**

- Decide criteria from observable evidence only.
- Support paraphrases (`includes-any`) and structured facts (regex).
- Make "repeating the rule" fail.
- Stay deterministic, offline, dependency-free.

**Non-Goals:**

- No LLM/semantic judge and no network (a versioned external judge is a
  separate future change; if added, its version/config must be recorded).
- No change to prompt content or to the run/decision pipeline from change 01.

## Decisions

- **Structured `oracle` object replaces `check`.**
  `{ "kind": "includes-all" | "includes-any" | "excludes-any" | "matches" | "not-matches",
     "values": ["..."], "flags": "i" }`.
  Rationale: one explicit, testable shape; prose lives in `description`
  (non-evaluated). Alternative: keep `check` and add `any`/`pattern` — rejected,
  invites accidental prose matching.

- **`description` is never an oracle.** A test asserts that output equal to the
  description (without the observable values) fails `PQ-ORACLE-02`.

- **Matching rules.** Case-insensitive by default. `includes-all` ⇒ all values
  present; `includes-any` ⇒ at least one; `excludes-any` ⇒ none; `matches` ⇒
  regex matches; `not-matches` ⇒ regex does not match. Empty/missing output ⇒
  `evaluable: false`, `passed: false` for every kind.

- **Regex safety.** Patterns are small, anchored where possible, and compiled
  per evaluation; invalid patterns ⇒ not-evaluable (never pass).

- **Suites rewritten to observable facts.** e.g. `verify.false-done` gains an
  `excludes-any` oracle for false-DONE tokens and an `includes-any` oracle for
  explicit "missing checks" reporting, with the intent kept in `description`.

## Risks / Trade-offs

- [Observable oracles still cannot fully capture semantics] → Accepted; this is
  the deterministic layer. Suites must use facts a compliant answer reliably
  contains. A future versioned judge can complement it.
- [Rewriting suites changes fixture expectations] → Fixtures and tests are
  updated together; `PQ-EXEC-01..05` from change 01 must stay green.
- [Regex catastrophic backtracking] → Ban unbounded nested quantifiers in
  review; patterns are short and applied to short outputs.

## Migration Plan

Additive to the decision pipeline; only the oracle shape changes. Rollback =
restore previous `check` matcher and suite criteria (single commit).

## Open Questions

- Should `not-matches` and `excludes-any` be merged? Default: keep both (one is
  literal, one is regex) for clarity.
