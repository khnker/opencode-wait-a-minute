# Frontend UX Benchmark

## ADDED Requirements

### Requirement: Three controlled benchmark conditions

The benchmark MUST define three conditions with identical initial repo snapshot, model, spec, tools, and constraints: A (WAM baseline), B (WAM + Impeccable), C (WAM + Impeccable + UX outcome evidence). Deviations from the controlled variables MUST be logged.

#### Scenario: Conditions use same initial state
- **WHEN** a benchmark run starts
- **THEN** all three conditions start from the identical repo commit and configuration

### Requirement: Defined corpus of five task cases

The benchmark MUST define a corpus of five frontend UX task cases. Each case MUST include: baseline repo, task spec, expected outcomes, known defects, and independent scoring rubric.

#### Scenario: Corpus defined with required fields
- **WHEN** the corpus is defined
- **THEN** each of the five cases contains baseline repo, task spec, expected outcomes, known defects, and scoring rubric

### Requirement: Independent scoring

Outcome artifacts MUST be scored by a party other than self-assessment against a fixed rubric covering: usability, visual hierarchy, accessibility, interaction behavior, responsive behavior, and regression risk.

#### Scenario: Independent scorer used
- **WHEN** a condition run completes
- **THEN** scoring is performed by an independent scorer against the fixed rubric and recorded separately from self-assessment

### Requirement: Per-condition and aggregate reporting

The benchmark MUST produce a per-case report per condition plus an aggregate summary, variability analysis, failures, and cost of improvement. Failed runs MUST remain in the report.

#### Scenario: Failed run retained
- **WHEN** a benchmark run fails
- **THEN** the failure is recorded in the report with explanation and does not prevent reporting of other runs

### Requirement: Comparative evidence only

No "better" claim MUST be made without comparative evidence from the benchmark itself. No arbitrary threshold MUST be asserted without baseline data and rationale.

#### Scenario: No claim without evidence
- **WHEN** a comparison is drawn between conditions
- **THEN** the comparative evidence is present in the benchmark report

### Requirement: No quality proxies

Length, findings count, and code volume MUST NOT be used as quality proxies. Only the fixed rubric scores and defined metrics are valid quality indicators.

#### Scenario: Proxies excluded
- **WHEN** metrics are computed
- **THEN** length, findings count, and code volume are excluded from quality assessment
