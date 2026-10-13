# Design: fix-quality-benchmark-final-answer-injection
## Context
`runPairedScenario({ scenario, provider })` builds each arm's request with
`buildBaselineRequest(turn)` / `buildWamRequest(scenario, turn)` and calls
`provider.complete(request)` directly. The final-answer instruction helper lived
in `run-quality.mjs` but was never wired in.

## Goals / Non-Goals
**Goals**
- Apply `ANSWER_INSTRUCTION` to the last user message of **both** arms.
- Keep the transformation pure (copy, no mutation) and deterministic.
- Make the behavior testable without the network.

**Non-Goals**
- Do not change the shared paired runner or its other callers.
- Do not change prompt content, scoring, or the judge path.

## Decisions
- **Wrap the provider in `runQualitySuite`, not the runner.** A small object
  `{ ...resolvedProvider, complete(req) => resolvedProvider.complete({ ...req, messages: appendFinalAnswerInstruction(req.messages) }) }`
  keeps the change local to the quality benchmark and preserves `this` binding by
  calling the method on `resolvedProvider`.
- **Fix the index computation.** `findLastIndex` alone yields the last user
  index; the `lastIndexOf(number)` wrapper always produced `-1`.
- **Accept a provider object.** `provider` may now be `"mock"`, a provider
  object (tests), or `undefined` (resolved). Enables a deterministic end-to-end
  assertion of the injection.

## Risks / Trade-offs
- [Provider spread loses bound methods] → Mitigated: `complete` is invoked as
  `resolvedProvider.complete(...)`, so `this` is the real provider.
- [Double injection if a caller already appended] → Only `runQualitySuite` wraps;
  the helper is pure and the raw provider is untouched.

## Migration Plan
Localized bug fix; rollback = revert the single commit. No data migration.
