# Design: Repair pre-existing suite baseline

## Context

The full suite reports three failures unrelated to new work. Each is a drift between
committed expectations and the current, intentional implementation.

## Research

- Node.js test runner — `node --test`, force-exit behavior and deterministic output:
  https://nodejs.org/api/test.html
- NIST SP 800-218 (SSDF) — keep verification baselines current and reproducible so that
  a failing gate signals a real regression:
  https://csrc.nist.gov/pubs/sp/800/218/final
- OWASP LLM06:2025 Excessive Agency — delegated/task actions must remain bounded and
  explicitly governed rather than implicitly trusted:
  https://genai.owasp.org/llmrisk/llm062025-excessive-agency/

## Decisions

### 1. Regenerate baselines with the freezer, never by hand

`benchmarks/quality/prompt-eval/freeze-baseline.mjs` derives hashes from the deterministic
prompt generator. The only semantic diff produced is the `injection.delegation` hash in
`core.json` and `delegation.json` (`f3d0e721…` → `1fbe17ca…`), which matches the legitimate
earlier prompt update. Hand-editing hashes would hide generator drift and defeat the
byte-for-byte reproducibility test.

### 2. `task` stays in scope and remains GUARDED

`src/policy/action-capabilities.js` explicitly catalogues `task` as GUARDED with the comment
"delegation: GUARDED, not SAFE", and
`openspec/specs/integrate-autonomy-runtime/spec.md` requires it. The
`OUT_OF_SCOPE_TOOLS` entry was a bypass that downgraded the effective capability to SAFE.
Removing only that entry restores the intended classification without touching runtime
guard semantics. `compress`, `delegate_task`, `call_agent` and `skill` remain out of scope.

### 3. Assert the current advisory wording

The prompt now says the main session "puede editar/escribir inline sin pedir permiso". The
test must verify the advisory contract (mutation allowed, no approval demanded), not a
retired token.

## Rejected alternatives

- **Change `task` to SAFE.** Contradicts the explicit catalog comment and the
  `integrate-autonomy-runtime` spec, and weakens a security-relevant guard. Rejected.
- **Restore the old `PERMITIDA` wording in the prompt.** Unnecessary prompt churn; the
  current wording carries the same advisory semantics. Fixing the assertion is smaller and
  keeps the prompt immutable. Rejected.
- **Regenerate only `core.json`.** `delegation.json` pins the same prompt hash and would
  stay stale, leaving the suite red. Rejected.
- **Update only the assertion for `task` (expect SAFE).** Codifies the bug and violates the
  spec. Rejected.

## Risks

- Regenerating all suites could surface unrelated drift; the diff is inspected and must
  contain only the delegation hash.
- Removing the bypass means callers relying on SAFE `task` classification will now see
  GUARDED. That is the intended behavior per spec; runtime guard logic is unchanged.
