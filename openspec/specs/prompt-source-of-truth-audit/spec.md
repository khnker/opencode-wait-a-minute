# prompt-source-of-truth-audit Specification

## Purpose
TBD - created by archiving change prompt-source-of-truth-audit. Update Purpose after archive.
## Requirements
### Requirement: Model-Directed String Inventory
The audit SHALL list every model-directed string site found under the repository with its file:line, the construct that produced it, and whether the site routes through `loadPrompt`.
#### Scenario: Inventorying a raw site
- GIVEN a source file containing a model-directed literal outside `loadPrompt`
- WHEN the audit scans the repository
- THEN the report includes the site's file:line, construct, and classification.
#### Scenario: Inventorying a centralized site
- GIVEN a source file calling `loadPrompt("<id>")`
- WHEN the audit scans the repository
- THEN the referenced id is recorded as a centralized usage for that location.

### Requirement: Catalog Cross-Reference
The audit SHALL cross-reference the catalog and detect (a) prompts registered in `prompts/index.json` but never referenced by `loadPrompt`, (b) catalog consumer references that do not resolve to an existing file, and (c) raw literal sites that semantically duplicate a registered prompt.
#### Scenario: Detecting an orphan prompt
- GIVEN a prompt id registered in the catalog with no `loadPrompt("<id>")` usage
- WHEN the audit cross-references centralized usages against the catalog
- THEN the prompt id is reported as registered-but-unused.
#### Scenario: Detecting a stale consumer
- GIVEN a catalog consumer reference `path#symbol` whose file does not exist
- WHEN the audit resolves consumer paths against the filesystem
- THEN the reference is reported as stale with the missing path.
#### Scenario: Detecting a duplicate candidate
- GIVEN a raw candidate literal whose normalized text equals a registered prompt body or responsibility
- WHEN the audit compares candidates against registered prompts
- THEN the candidate is reported with the matching prompt id.

### Requirement: Deterministic vs Instruction Classification
The audit SHALL classify each raw site as `centralized`, `candidate`, or `deterministic`, and MUST NOT auto-migrate any site.
#### Scenario: Classifying a deterministic literal
- GIVEN a raw literal matching a documented deterministic pattern (error message, log label, identifier, or pure interpolation)
- WHEN the audit classifies the site
- THEN it is reported as `deterministic` with the matching rule.
#### Scenario: Classifying an instruction candidate
- GIVEN a raw literal that is not deterministic and does not route through `loadPrompt`
- WHEN the audit classifies the site
- THEN it is reported as `candidate` for human review.

### Requirement: Reproducible Report
The audit SHALL emit a deterministic, sorted report and SHALL support a `--json` output.
#### Scenario: Reproducible output
- GIVEN an unchanged repository
- WHEN the audit runs twice
- THEN both reports are byte-identical with sites sorted by path then line and ids sorted.
#### Scenario: JSON output
- GIVEN the audit is invoked with `--json`
- WHEN it completes
- THEN stdout is a single parseable JSON object with the report data.

### Requirement: Non-Destructive
The audit SHALL be read-only and MUST NOT modify, migrate, or delete any source or prompt file.
#### Scenario: Read-only execution
- GIVEN the audit runs against a clean working tree
- WHEN it completes
- THEN no tracked file has changed.

