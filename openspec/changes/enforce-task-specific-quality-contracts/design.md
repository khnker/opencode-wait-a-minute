# Design — Enforce Task-Specific Quality Contracts

## Research

- ISO/IEC 25010 quality model — quality attributes must be defined per
  product/context, not as one universal checklist:
  https://iso25000.com/index.php/en/iso-25000-standards/iso-25010
- ACM Artifact Review and Badging v1.1 — evidence must be available, functional,
  reproducible and independently reviewable:
  https://www.acm.org/publications/policies/artifact-review-and-badging-current
- NIST SP 800-218 (SSDF) — verification evidence is tied to the artifact and
  its provenance, not to a narrative:
  https://csrc.nist.gov/pubs/sp/800/218/final
- OpenCode plugin lifecycle (event boundaries used by the adapter):
  https://opencode.ai/docs/plugins/

## Alternatives Considered

1. **Strictness determined only by task type** (original framing).
   Rejected: task type is inferred and can be wrong; a single label would
   override stronger criterion-level evidence. Chosen instead: type supplies
   defaults, explicit criterion `evidenceRequirements` always win.
2. **LLM-as-judge sufficiency.**
   Rejected: non-deterministic, unauditable and self-grading. The evaluator must
   be a pure function of persisted inputs.
3. **Fold this into `task-quality-contract`.**
   Rejected: that change is already large and its contract structure is a
   prerequisite. A separate delta keeps review and rollback bounded.
4. **Time-only staleness.**
   Rejected as the primary signal: a clock cannot prove the evidence still
   refers to the current artifact. Chosen: `sourceRef` + content hash, with
   `maxAgeMs` only as an additional guard.
5. **Second evidence ledger.**
   Rejected: `execution-ledger` and `outcome-evaluator` already own evidence.
   This change adds a read-only projection, never a parallel source of truth.

## Architecture

```
task state + contract + evidence
        │
        ▼
src/quality/task-quality-contract.js   (pure)
  resolveQualityContract()
  evaluateEvidenceSufficiency()
  detectStaleEvidence()
  detectContradictions()
        │  { sufficient, missing, stale, contradictions, score }
        ▼
session-driver snapshot.quality ──► decideNextAction()
        │                              │
        │                              ├─ missing/stale → VERIFY
        │                              └─ contradiction → REPLAN
        ▼
evaluateCompletionGate(state, promptText, { quality })
```

### Task kinds

`research | implementation | debugging | refactoring | review | documentation | unknown`

Each profile declares defaults only:

| Kind | Required evidence (default) |
| --- | --- |
| research | sources (L2+), coverage, consistency check |
| implementation | test result (L4), diff/change, behavior check |
| debugging | reproduction (L2+), failing test, resolution test (L4) |
| refactoring | equivalence check (L3+), regression tests (L4) |
| review | findings with severity, evidence per finding, scope check |
| documentation | source correspondence, accuracy check |
| unknown | no template; criterion requirements only |

### Precedence

1. Criterion-level `evidenceRequirements` (authoritative; replaces the profile
   for that criterion).
2. Kind profile defaults (apply only when the criterion declares nothing).
3. Unknown kind with no criterion requirements imposes nothing (fail-open);
   strictness is opt-in per criterion.

### Sufficiency rules

- Every mandatory criterion needs its required evidence types at or above the
  minimum strength.
- `minCount` applies per type, not across types.
- A satisfied criterion with only `L0_CLAIM`/`L1_INFERENCE` is insufficient.
- Optional criteria never block, but contradictions in them are reported.
- The evaluator returns reasons, never throws, for malformed evidence; it
  throws only for an invalid contract (trust boundary).

### Staleness

- Evidence carries `sourceRef` (file/artifact id) and `hash`.
- If the current artifact hash differs, the evidence is stale.
- If `maxAgeMs` is configured and `now - timestamp > maxAgeMs`, it is stale.
- Hash checks apply when both `sourceRef` and `hash` are present; evidence
  without provenance is not silently treated as fresh, but it also does not
  invent a staleness verdict.

### Contradictions

- Any failed evidence item recorded for a mandatory criterion.
- Two evidence items for the same `sourceRef` with different hashes and no
  explicit supersession (`supersedes` id).
- Contradictions map to `REPLAN`, not to a silent pass.

### Integration and rollback

- New config: `qualityContracts: { enabled: false }`.
- When disabled, `evaluateCompletionGate` receives no `quality` input and
  behavior is byte-for-byte today's behavior.
- When enabled, `gateComplete` requires `quality.sufficient !== false`.
- The adapter persists the quality snapshot in the loop event, so a decision is
  replayable.

## Risks

- Kind inference can be wrong; mitigations: explicit kind wins, unknown never
  blocks, and the reason string always names the profile used.
- Stricter gates can increase false blocks; the flag is off by default and
  Change 13 measures false acceptance vs false block before enabling.
- Hash computation cost on large artifacts; hash only referenced artifacts and
  cache by `sourceRef + mtime + size`.
