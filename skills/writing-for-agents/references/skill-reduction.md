# Skill Reduction Rules

Reduction preserves the behaviour that produces value and removes context cost that does
not change decisions. A shorter file is not evidence of a valid reduction.

## Reduction contract

```text
SKILL REDUCTION CONTRACT

1. Identify the skill's unique responsibility.
2. Identify every instruction that changes agent behavior.
3. Remove no-ops, duplication and stale content.
4. Preserve decision rules, constraints and failure handling.
5. Move conditional knowledge to on-demand references.
6. Consolidate overlapping responsibilities before deleting content.
7. Preserve explicit activation boundaries.
8. Measure token reduction using the target model tokenizer.
9. Validate activation, behavior and regression against representative tasks.

A reduction is valid only when context cost decreases
without degrading the skill's intended behavior.
```

## General rules

| ID | Rule | Action |
| --- | --- | --- |
| RED-01 | Behavioral value | Keep instructions that change decisions or results. |
| RED-02 | Single source of truth | Give each rule one authoritative location. |
| RED-03 | No-op removal | Remove instructions the model already follows by default. |
| RED-04 | No duplication | Remove repeated concepts with different wording. |
| RED-05 | Progressive disclosure | Move specialized references out of the main body. |
| RED-06 | Environment over documentation | Do not repeat information verifiable in code, config, or CLI. |
| RED-07 | Decision density | Prefer one operational rule over several explanatory paragraphs. |
| RED-08 | Preserve constraints | Keep restrictions that prevent relevant errors. |
| RED-09 | Explicit activation | State when the skill activates and when it does not. |
| RED-10 | Evidence-based pruning | Validate reductions by execution, not text review alone. |

## Rules by skill type

### A. Router / Orchestration

Examples: `web-design`.

Reduce aggressively. Keep activation conditions, task classification, destination per
category, exclusion conditions, and contextual loading rules. Remove implementation
instructions, design principles owned by another skill, descriptions of runtime
capabilities, and workflows that repeat destination skills.

Criterion: the router decides where work goes, not how to execute it.

### B. Engineering / Implementation

Examples: `craftsman`, `agentic-code-foundations`.

Reduce moderately. Keep invariants, design heuristics, abstraction criteria, domain
constraints, rules for modifying existing code, and contract verification. Remove
explanations of known principles, redundant examples, duplicated invariants/audits, and
language-specific style rules the project already exposes.

Criterion: direct engineering decisions; do not document a complete architecture.

### C. Diagnostic / Troubleshooting

Examples: `diagnosing-bugs`.

Reduce conservatively. Keep problem reproduction, evidence before hypothesis, isolation
and minimization, hypothesis falsification, root-cause confirmation, and a verifiable
regression. Remove repeated cause lists, debugging theory, environment commands, and
intermediate reports without diagnostic value.

Criterion: do not reduce diagnostic rigor to save tokens.

### D. Verification / Testing

Examples: `tdd`.

Reduce conservatively. Keep execution order, stage transitions, required evidence,
acceptance criteria, failure handling, and false-positive constraints. Remove testing
introductions, framework catalogs, project-discoverable commands, and duplication with
the debugging protocol.

Criterion: preserve the verification loop, not its pedagogical explanation.

### E. Architecture / Design Reference

Examples: `codebase-design`, `design-system`.

Reduce selectively. Keep specialized vocabulary, decision criteria, trade-offs,
application boundaries, and references needed for depth. Remove obvious definitions,
diagrams that do not change decisions, repeated concepts, and examples without an
exception or distinction.

Criterion: preserve differential knowledge; do not turn it into a tutorial.

### F. UI / Visual Design

Examples: `visual-review`, `no-slop-ui`.

Consolidate before reducing. Keep visual direction, composition, hierarchy, responsive
behavior, accessibility, interaction states, real visual verification, and anti-slop
constraints that prevent concrete defects. Remove duplicated visual rules, repeated
spacing/type scales, equivalent prohibition lists, and generic frontend rules covered by
the design system.

Criterion: one authority per visual dimension.

### G. Prototype / Exploration

Example: `prototype`.

Reduce little. Keep the question the prototype answers, modality selection, isolation
from production, ease of execution, and the criterion for transferring learning to the
product. Remove production rules, exhaustive testing, unnecessary architecture, and
implementation documentation.

Criterion: optimize learning per unit of effort, not production quality.

### H. Handoff / Communication

Example: `handoff`.

Reduce little. Keep information needed to continue, verifiable state, dependencies and
blockers, artifacts and references, and an unambiguous next action. Remove chronological
narration, context already in artifacts, repeated summaries, and ceremonial reports.

Criterion: transfer state and continuation capacity, not the history of the work.

### I. Meta-skill / Skill Authoring

Example: `writing-for-agents`.

Reduce with semantic validation. Keep activation design, information hierarchy,
progressive disclosure, context load, completion criteria, single source of truth, and
pruning/no-op detection. Remove repeated theory, metaphors that do not produce a
decision, linguistic variants of one heuristic, and examples without an edge case.

Criterion: preserve the capacity to design good skills, not the volume of explanation.

## Severity levels

| Level | Operation | Condition |
| --- | --- | --- |
| R0 | No change | Skill is compact and has no significant redundancy. |
| R1 | Pruning | Remove redundancies and no-ops. |
| R2 | Compression | Rewrite while preserving decisions and constraints. |
| R3 | Disclosure | Extract conditionally used references. |
| R4 | Consolidation | Merge skills with overlapping responsibilities. |
| R5 | Removal | Remove a skill with no differential responsibility. |

Prefer R1 → R2 → R3 → R4 → R5. Do not merge before identifying each skill's unique
behavior.

## Mandatory validation

| Dimension | Question |
| --- | --- |
| Activation | Does it activate in the same correct scenarios? |
| Precision | Does it preserve the decisions it was meant to direct? |
| Constraints | Does it still prevent the errors it prevented before? |
| Coverage | Does it keep the important edge cases? |
| Independence | Can it run without accidental context? |
| Regression | Did it introduce incorrect behavior or lose capabilities? |
| Token cost | Did real context cost decrease? |

## WAM application

This is the single maintenance policy for WAM skills. Do not copy these rules into each
skill; that would create the duplication RED-04 removes. Apply the contract when editing
an existing skill, use the type-specific rules to decide what is safe to cut, and record
the validation evidence in the change that performs the reduction.
