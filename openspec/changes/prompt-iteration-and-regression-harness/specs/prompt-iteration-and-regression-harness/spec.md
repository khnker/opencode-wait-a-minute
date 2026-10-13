# Prompt Iteration and Regression Harness Spec
## ADDED Requirements
### Requirement: Fixture Set
Every registered prompt SHALL have a fixture with concrete input variables.
#### Scenario: 100% fixture coverage
- GIVEN `prompts/index.json` lists the registered prompts
- WHEN fixtures under `prompts/fixtures/` are enumerated
- THEN every catalog id has a matching fixture file carrying concrete input vars, and a missing fixture fails the coverage check.
#### Scenario: Fixture drives rendering
- GIVEN a fixture with concrete `vars`
- WHEN its prompt is rendered
- THEN the variables are substituted into the rendered string.
### Requirement: Rendered Output Capture
The harness SHALL render the exact string `loadPrompt(id, vars)` returns for both base and candidate.
#### Scenario: Base equals runtime
- GIVEN a registered prompt and its fixture vars
- WHEN the harness captures the base render
- THEN the captured string equals what a consumer receives from `loadPrompt(id, vars)`.
#### Scenario: Candidate uses identical interpolation
- GIVEN a candidate Markdown body and the same fixture vars
- WHEN the harness captures the candidate render
- THEN the same interpolation contract is applied with frontmatter stripped, so base and candidate are compared on equal footing.
### Requirement: Base vs Candidate Comparison
The harness SHALL diff rendered outputs and report token delta, placeholder parity, restriction integrity, and preserved requirements.
#### Scenario: Report contents
- GIVEN a base prompt and a candidate prompt
- WHEN the comparison runs
- THEN the report includes the unified diff, `tokensBase`/`tokensCandidate`/`tokensDelta`, placeholder set parity, restriction integrity (missing `mustContain`, offending `mustNotContain`), and whether the base contract is preserved.
### Requirement: Quality Over Token Count
The harness SHALL NOT treat a token reduction as acceptance; acceptance REQUIRES restriction integrity and placeholder parity to hold.
#### Scenario: Smaller candidate that drops a restriction is rejected
- GIVEN a candidate render with fewer tokens than base
- WHEN the candidate drops a `mustContain` substring or breaks placeholder parity
- THEN the verdict is `reject` and the token delta does not change that outcome.
#### Scenario: Unchanged comparison
- GIVEN a candidate identical to base
- WHEN the comparison runs
- THEN the verdict is `unchanged`.
### Requirement: Deterministic by Default
Real-model evaluation MUST be opt-in and excluded from CI.
#### Scenario: Eval is opt-in
- GIVEN the harness is invoked without `--eval`
- WHEN it produces a report
- THEN it performs no network I/O.
#### Scenario: Eval not configured
- GIVEN the harness is invoked with `--eval`
- WHEN real-model evaluation is not implemented
- THEN it prints `real-model evaluation not configured; skipped` and performs no network I/O.
