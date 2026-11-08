# Reduction report

Policy: `skills/writing-for-agents/references/skill-reduction.md` (`RED-01`..`RED-10`).
Rounds: `R0` unchanged, `R1` no-op/formatting, `R2` duplication and examples, `R3`
semantic compression. No `R4` merges or `R5` removals in this change.

| Skill | Level | Before | After | Delta | Preserved behavior markers |
| --- | --- | ---: | ---: | ---: | --- |
| `agentic-code-foundations` | R2 | 1717 | 1529 | -188 | code rules, architecture boundaries, agent-readable context, correctness/security/integrity |
| `codebase-design` | R3 | 6066 | 5053 | -1013 | module/interface/depth/seam/adapter/leverage/locality, deletion test, `DEEPENING.md`, `DESIGN-IT-TWICE.md` |
| `craftsman` | R2 | 5438 | 5172 | -266 | `INV-01`..`INV-05`, Craftsman Ladder `RUNG-1`..`RUNG-5`, diff audit, output contract |
| `design-contract` | R3 | 1343 | 934 | -409 | contract file, token plan, anti-slop rules, state definitions, critique loop |
| `design-critique` | R1 | 785 | 711 | -74 | hierarchy, readability, cognitive load, interaction design, findability |
| `design-system` | R3 | 540 | 409 | -131 | `ui-rules.md`, `tokens.md`, `image-analysis.md` references |
| `diagnosing-bugs` | R2 | 8661 | 7728 | -933 | secret redaction, tight feedback loop, red-capable criterion, minimise, hypotheses, instrumentation, fix/regression, cleanup |
| `frontend-design` | R0 | 1869 | 1869 | 0 | all core principles retained; redundant-cut candidate restored after review |
| `handoff` | R1 | 940 | 917 | -23 | temp-directory handoff, current state/blockers/next action, suggested skills, redaction |
| `improve-codebase-architecture` | R2 | 5998 | 5488 | -510 | deepening opportunities, deletion test, HTML report, recommendation strength, glossary/ADR side effects |
| `linter-negative` | R2 | 3575 | 3318 | -257 | activation boundary, visual baseline, colour priority, stack notes, hard rules |
| `no-slop-ui` | R2 | 1612 | 1332 | -280 | magic values, nested overrides, contract fidelity, state completeness, enforcement workflow |
| `prototype` | R1 | 2923 | 2802 | -121 | throwaway question, trivial run, no persistence by default, skip polish, capture decision |
| `tdd` | R2 | 3621 | 3188 | -433 | red-green loop, seams, vertical slices, anti-patterns, tautological/horizontal-slice failures |
| `visual-review` | R1 | 7203 | 6935 | -268 | viewport matrix, browser-tooling fallback, hard gates, cliche budget, signature device |
| `web-design` | R2 | 1233 | 1226 | -7 | activation, classification, context loading, reference routing, `DESIGN.md` handling |
| `wizard` | R3 | 4115 | 3315 | -800 | scope, stage journey, template helpers, irreversible-action confirmation, static verification |

Reduced total (excluding `frontend-design`): **55,770 -> 50,057 chars (-5,713, -10.2%)**.

`writing-for-agents` is the authoritative policy and is deliberately excluded from this
pass; `frontend-design` was audited and left unchanged because its remaining lines are
load-bearing constraints.

Guarded by `tests/unit/skill-reduction-invariants.test.mjs`.
