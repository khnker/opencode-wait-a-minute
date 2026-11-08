# Authoring record: verify

```yaml
skill:
  name: verify
  purpose: Produce traceable evidence and refuse completion while the runtime gate has pending work.

scenario:
  input: A task has a mandatory requirement but no executed verification check.
  expected_behavior: The agent reports the pending criterion and does not claim DONE.

baseline:
  observed_behavior: The agent claimed DONE after writing code, without an observable check.
  failure_mode: False completion supported only by the implementation itself.

implementation:
  changes:
    - Added the verify skill procedure.
    - Added runtime checks for structured evidence provenance and backlog.

verification:
  evidence: tests/unit/verify-skill.test.mjs and tests/unit/completion-invariants.test.mjs
  result: PASS

measure:
  metric: false completion claims blocked by the runtime gate
  baseline: "advisory only; structured evidence not checked"
  after: "structured evidence checked; advisory default preserved"
```
