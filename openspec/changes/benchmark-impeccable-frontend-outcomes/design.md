# Benchmark Impeccable Frontend Outcomes — Design

## Goal

Measure whether Impeccable improves WAM frontend outcomes and for which task types, using controlled conditions and independent scoring.

## Benchmark Conditions

| Condition | Description |
|-----------|-------------|
| A | WAM baseline (no Impeccable integration) |
| B | WAM + Impeccable (no extra UX outcome evidence enforcement) |
| C | WAM + Impeccable + UX outcome evidence enforcement |

Each condition uses the same model, spec, repo snapshot, tools, and constraints.

## Corpus (5 Task Cases)

Each corpus case includes: baseline repo commit, task spec, expected outcomes, known defects list, and an independent scoring rubric.

### Case 1: New screen from requirement
- **Type**: greenfield
- **Known defects**: none
- **Scoring**: usability, visual hierarchy, a11y, interaction behavior

### Case 2: Improve form with known interaction/validation defects
- **Type**: improvement
- **Known defects**: interaction bug A, validation bug B
- **Scoring**: interaction behavior, visual hierarchy, regression risk

### Case 3: Fix responsive layout with reproducible viewport failures
- **Type**: bug fix
- **Known defects**: viewport failures at 320px, 768px, 1440px
- **Scoring**: responsive behavior, visual layout, regression risk

### Case 4: Improve keyboard nav + accessible states
- **Type**: a11y improvement
- **Known defects**: missing focus styles, broken tab order
- **Scoring**: accessibility, interaction behavior, regression risk

### Case 5: Refine visually inconsistent component without changing functional contract
- **Type**: refinement
- **Known defects**: inconsistent spacing, font weights
- **Scoring**: visual hierarchy, usability, regression risk

## Metrics

### Primary Metrics
- Critical acceptance criteria achieved (%)
- Relevant defects corrected (count)
- False-positive UX findings (count)
- Functional/visual regressions introduced (count)
- UX quality score (1-5 per dimension, independent rubric)

### Secondary Metrics
- A11y findings resolved (count)
- Iterations / time to resolution
- Tokens consumed / tool calls
- Unresolved issues remaining (count)
- Unsupported completion claims (count)

### Scoring Rubric (fixed, independent)

Each dimension scored 1-5:
- **Usability**: task is easier/smoother for end user
- **Visual hierarchy**: information architecture clarity
- **Accessibility**: keyboard nav, screen reader support, WCAG compliance
- **Interaction behavior**: forms, buttons, transitions behave correctly
- **Responsive behavior**: correct rendering across viewports
- **Regression risk**: probability of breaking existing functionality

## Architecture & Flow

1. **Setup**: snapshot the corpus repo at a fixed commit; record the exact state.
2. **Execution**: for each corpus case, run each condition (A/B/C) independently.
3. **Repeatability**: run each condition at least 3 times when variability matters; report variance.
4. **Scoring**: an independent scorer (not self-assessment) scores each outcome against the fixed rubric.
5. **Reporting**: produce per-case report + aggregate summary + variability analysis + failures + cost of improvement.

## Report Structure

```
## Per-Case Results
### Case N: [name]
- Condition A: [metrics]
- Condition B: [metrics]
- Condition C: [metrics]
- Independent scores: [rubric scores]
- Failures: [any]
- Cost: [tokens/time]

## Aggregate Results
- Overall quality improvement (B vs A, C vs B)
- Defect correction rate
- False-positive rate
- Regression rate

## Variability Analysis
- Run variance per condition
- Outliers and failure modes

## Conclusion
- Improvement evidence (or lack thereof) per task type
- Recommendations
```

## Acceptance Criteria for the Benchmark

- Equivalent initial states across all conditions (same repo commit, same model).
- Reproducible from recorded fixtures and configuration.
- Distinguishes implementation success from UX improvement.
- Failed runs remain in the report with explanation.
- No "better" claim without comparative evidence from the benchmark itself.
- No arbitrary quality threshold without baseline data and rationale.
