# enforce-prompt-catalog-integrity Specification

## Purpose
TBD - created by archiving change enforce-prompt-catalog-integrity. Update Purpose after archive.
## Requirements
### Requirement: Catalog Structural Validation
`prompts/index.json` MUST contain unique, non-empty ids, and every entry MUST reference a relative `.md` path that resolves inside `prompts/` and exists on disk. Prompt files under `prompts/` MUST be registered in the catalog.
#### Scenario: Duplicate id
- GIVEN a catalog with two entries sharing the same id
- WHEN running `npm run prompts:check`
- THEN the duplicate is reported and the command exits non-zero.
#### Scenario: Path escapes the prompts directory
- GIVEN a catalog entry whose path is absolute or contains `..`
- WHEN running the integrity check
- THEN the escape is reported and the command exits non-zero.
#### Scenario: Missing prompt file
- GIVEN a catalog entry whose path does not exist under `prompts/`
- WHEN running the integrity check
- THEN the missing file is reported and the command exits non-zero.

### Requirement: Interpolation Contract
Every `{{var}}` placeholder in a prompt body MUST be declared in that file's `inputs`, and every declared input MUST be used by the body.
#### Scenario: Undeclared placeholder
- GIVEN a prompt whose body contains `{{var}}` that is absent from `inputs`
- WHEN running the integrity check
- THEN the undeclared placeholder is reported and the command exits non-zero.
#### Scenario: Unused declared input
- GIVEN a prompt whose `inputs` lists a variable the body never uses
- WHEN running the integrity check
- THEN the unused input is reported and the command exits non-zero.

### Requirement: Reference Resolution
Every `consumers[]` entry (form `path` or `path#symbol`) MUST resolve to an existing file, and when a `#symbol` is present that symbol MUST appear in the file. Every `testRefs[]` entry MUST resolve to an existing file.
#### Scenario: Missing consumer file
- GIVEN a `consumers[]` entry pointing at a non-existent file
- WHEN running the integrity check
- THEN the missing file is reported and the command exits non-zero.
#### Scenario: Missing consumer symbol
- GIVEN a `consumers[]` entry with `#symbol` absent from the referenced file
- WHEN running the integrity check
- THEN the missing symbol is reported and the command exits non-zero.
#### Scenario: Missing test reference
- GIVEN a `testRefs[]` entry pointing at a non-existent file
- WHEN running the integrity check
- THEN the missing reference is reported and the command exits non-zero.

### Requirement: Usage Agreement
Every registered prompt id MUST be referenced by at least one `loadPrompt("<id>")` in non-test source, and every `loadPrompt("<id>")` in non-test source MUST be registered.
#### Scenario: Orphan prompt
- GIVEN a registered prompt id with no `loadPrompt("<id>")` reference in non-test source
- WHEN running the integrity check
- THEN the orphan is reported and the command exits non-zero.
#### Scenario: Unregistered usage
- GIVEN a `loadPrompt("<id>")` call in non-test source whose id is absent from the catalog
- WHEN running the integrity check
- THEN the unregistered usage is reported and the command exits non-zero.
#### Scenario: Non-literal argument
- GIVEN a `loadPrompt(variable)` call whose argument is not a string literal
- WHEN running the integrity check
- THEN it is skipped and does not produce a violation.

### Requirement: Gate Enforcement
`npm run prompts:check` MUST return non-zero on any violation and MUST be invoked as a required step of the release/validation gate.
#### Scenario: Gate blocks on drift
- GIVEN any catalog/file/interpolation/reference/usage divergence
- WHEN the release gate runs the prompt integrity step
- THEN the step fails and the gate verdict is BLOCKED.

