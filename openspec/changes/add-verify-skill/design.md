# Design: Verify Skill

## Research

- ISO/IEC 25010 quality model — completion criteria must be explicit and
  checkable, not inferred from a claim: https://iso25000.com/index.php/en/iso-25000-standards/iso-25010
- ACM Artifact Review and Badging v1.1 — a result is accepted only when the
  evidence is available and verifiable: https://www.acm.org/publications/policies/artifact-review-and-badging-current
- Scrum Definition of Done — a shared, checkable exit condition prevents
  nominal completion: https://www.scrum.org/resources/what-definition-done
- Agent Skills authoring guidance — skills are procedural instructions with
  explicit activation boundaries and verification criteria:
  https://agentskills.io/specification
- Repository workflow — `AGENTS.md` requires research, alternatives, spec,
  smallest diff, regression tests, build, and validation.

## Decision

Add a skill, not a new workflow engine. The skill owns the *procedure*:

1. Identify mandatory acceptance criteria.
2. Map each criterion to an observable check.
3. Run the check and record evidence.
4. Distinguish implementation, execution, and verified result.
5. Claim completion only when the runtime gate reports no pending work.

The runtime owns *enforcement*. A new pure module,
`src/verification/completion-invariants.js`, checks the invariants that can be
derived from task state:

- valid task state (fail closed);
- no unresolved decision-critical assumptions;
- every mandatory requirement verified with evidence;
- structured evidence is same-session, fresh, non-contradictory, and strong
  enough for critical requirements;
- no pending backlog;
- completion/outcome contracts are satisfied.

`evaluateCompletionGate` calls this checker before its legacy checks. The
existing `completionGate.enforce` flag still decides whether a blocked verdict is
hard-blocking or advisory, so the default zero-friction behavior is preserved.

## Alternatives considered

1. **Skill only, no runtime change.**
   Rejected: the skill would claim invariants that the runtime does not check,
   and structured evidence could still pass with cross-session or stale data.
2. **Change the completion gate default to hard blocking.**
   Rejected: the archived completion-gate design explicitly preserves the
   advisory default; flipping it would break the zero-friction contract and
   dozens of tests.
3. **Put all checks in `orchestration.js`.**
   Rejected: orchestration already carries too much verification logic and the
   invariants need focused unit tests. A small pure verifier keeps the gate as a
   caller and follows the existing pillar boundary.

## Invariants

| ID | Invariant | Failure behavior |
| --- | --- | --- |
| V1 | Completion is fail-closed on malformed or missing state. | Block. |
| V2 | No blocking unknown or unresolved DECISION_CRITICAL assumption. | Block. |
| V3 | Every mandatory requirement is verified and has evidence. | Block. |
| V4 | Structured evidence is same-session and not stale/expired. | Block. |
| V5 | Supporting and contradicting evidence cannot coexist. | Block. |
| V6 | Critical requirements need direct evidence; non-critical need observation. | Block. |
| V7 | No pending backlog item. | Block. |
| V8 | Completion and outcome criteria are satisfied. | Block. |
| V9 | A skill cannot substitute for the runtime gate. | Skill reports; gate decides. |

## Evidence compatibility

Legacy string evidence and object evidence without provenance metadata remain
accepted. The new checks apply only when evidence carries the relevant fields
(`sessionId`, `timestamp`, `strength`, `supports`, `stale`). This keeps existing
task files readable while making structured evidence enforceable.

## Risks

- Over-blocking legacy tasks: mitigated by only enforcing metadata that exists.
- Skill routing noise: mitigated with narrow verification/completion triggers.
- Divergence from `verification-lifecycle`: the checker accepts both
  `status: "verified"` and `verificationStatus: "VERIFIED"`, matching the
  effective behavior of the current gate.
