# Quality Benchmark Integration

## Objective

Integrate the quality benchmark into the official validation workflow, making it discoverable, executable, and reproducible.

## Changes Needed

1. Provide a documented command to run the quality benchmark from a clean checkout.
2. Ensure the command supports explicit output directory and distinguishes offline/mock from real-provider results.
3. Add unit tests for scoring correctness covering exact matches, alternative answers, missing facts, empty/malformed responses, duplicated facts, partial coverage, and response extraction.
4. Verify fair baseline: both baseline and WAM receive equivalent task objectives, acceptance criteria, tools, and initial information.
5. Ensure deterministic offline behavior: repeatable with fixed fixtures, no network or credentials required.
6. Generate reports that identify suite/schema version, provider mode, model (if applicable), scenario/trial count, scoring method, invalid/excluded comparisons, output locations, and repository revision.
7. Integrate into the unified benchmark CLI if the output contract can be maintained without misrepresenting evidence class.
8. Add automated tests for scoring, result extraction, CLI arguments, and report generation.
9. Use existing report and evidence-manifest conventions.

## Acceptance Criteria

* A documented command runs the quality suite from a clean checkout.
* Offline execution requires no credentials or network access.
* Evaluator unit tests cover normal, boundary, and malformed cases.
* Baseline and WAM arms receive equivalent experimental inputs.
* Mock results are clearly labeled as mock results.
* Requested provider failures cannot silently produce a successful mock report.
* Reports and manifests are validated by automated tests.
* The benchmark is included in the appropriate local validation gate.
* Existing benchmark behavior and unrelated runtime code remain unchanged.
