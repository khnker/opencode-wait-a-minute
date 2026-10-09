# Design: Skill Authoring Protocol
## Pipeline
IDENTIFY -> PRESSURE SCENARIO -> BASELINE FAILURE -> MINIMAL SKILL -> GREEN ->
LOOPHOLE DISCOVERY -> REFINE -> VERIFY
## Authoring record (YAML)
skill: { name, purpose }
scenario: { input, expected_behavior }
baseline: { observed_behavior, failure_mode }
implementation: { changes }
verification: { evidence, result }
## Taxonomy
- `skill`: a capability/procedure that changes agent behavior (has a pressure scenario).
- `workflow`: an explicit composition of skills (CH-04). Not authored as a skill.
- `reference`: deep knowledge loaded on demand; no behavioral claim.
- `constraint`: an invariant enforced by validation, not by prompt.
## Exclusion rules
Reject authoring when the candidate is: a single solution; a mechanical rule belonging to
validation; project-specific information; or knowledge already present in another skill.
## Duplication
Normalize name/purpose/triggers and compare against the registry; a match above the
similarity threshold requires an explicit merge justification.
## Decisions
- Rationale capture is mandatory: record the failure mode the skill is meant to fix,
  so future edits can regress-test against it (CH-02).
