# Proposal: fix-quality-benchmark-final-answer-injection
## Why
The quality benchmark intends to append an identical "final answer" instruction
to the last user message of both arms (WAM and baseline) so each model commits
to a machine-extractable answer and the A/B stays fair. In practice the helper
`appendFinalAnswerInstruction` was dead code:

- It was never invoked: `runQualitySuite` passed the raw provider straight to
  `runPairedScenario`, so neither arm ever received `ANSWER_INSTRUCTION`.
- Its index computation was also wrong: `copied.lastIndexOf(copied.findLastIndex(...))`
  is `lastIndexOf(<number>)`, which is `-1`, so it would have silently skipped
  the append even if called.

Result: the benchmark scored answers produced under a different (unstipulated)
contract than the prompt promises, and the intended injection is untested.
## What Changes
- Fix the helper to append `ANSWER_INSTRUCTION` to the **last user message**
  (`findLastIndex`), returning a copy and never mutating the input.
- Actually apply the instruction to **both arms** by wrapping the resolved
  provider inside `runQualitySuite` before handing it to `runPairedScenario`.
- Allow `runQualitySuite` to accept a provider **object** (not just the `"mock"`
  name or a resolved provider) so the injection can be exercised deterministically.
- Add a regression test proving the exact message each arm receives carries the
  instruction, and that earlier messages are untouched.
## Capabilities
### New Capabilities
(none)
### Modified Capabilities
- `quality-benchmark`: both arms of a quality run must receive the identical
  final-answer instruction on the last user message; the run itself stays
  offline and deterministic.
## Impact
- Code: `benchmarks/quality/run-quality.mjs` and `benchmarks/quality/run-quality.test.mjs`.
- No change to shared `paired-runner.mjs`, prompts, or scoring. No new deps.
