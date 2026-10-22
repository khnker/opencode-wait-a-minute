# frontend-ux-prompts Specification

## Purpose
TBD - created by archiving change add-frontend-ux-prompt-suite. Update Purpose after archive.
## Requirements
### Requirement: Versioned prompt suite

The system MUST provide a versioned Markdown prompt suite under `prompts/frontend-ux/` with five prompts (`diagnose`, `design`, `refine`, `verify`, `review`) and a `manifest.json` catalog. Each prompt MUST have a stable `id`, a `version`, and an explicit structural output contract.

#### Scenario: Manifest references existing files
- **WHEN** the manifest is queried
- **THEN** all five referenced prompt files exist on disk and contain the declared id and version

### Requirement: Prompt contract completeness

Every prompt MUST define: intended use/activation, required input, expected output, constraints/non-goals, evidence requirements, failure/fallback, stable id, and version.

#### Scenario: Every prompt has complete contract
- **WHEN** each prompt file is inspected
- **THEN** it contains all required contract fields in its frontmatter

### Requirement: Structural output via fixtures

Fixtures under `prompts/frontend-ux/__fixtures__/` MUST produce the expected structural output for each prompt. A passing fixture proves the prompt returns a correctly shaped response; it does not prove the response is correct.

#### Scenario: Fixtures produce expected structure
- **WHEN** fixtures are run
- **THEN** each prompt's fixture returns the expected structural output contract

### Requirement: Observed defects distinguished from hypotheses

Every prompt MUST distinguish between observed defects and hypotheses. The prompt MUST NOT produce invented usability findings or quantitative improvements without evidence.

#### Scenario: Findings labeled by type
- **WHEN** a prompt output is produced
- **THEN** each finding is labeled as `observed` or `hypothesis` and never as a quantitative improvement without supporting evidence

### Requirement: Backend-only tasks do not activate

Prompts MUST NOT be activated for backend-only tasks. Activation is gated by the frontend UX task classifier.

#### Scenario: Backend-only task does not activate prompts
- **WHEN** a backend-only task is processed
- **THEN** no frontend UX prompt is activated

### Requirement: Missing context reported not fabricated

When required context is missing, the prompt output MUST report the missing context explicitly and MUST NOT fabricate findings.

#### Scenario: Missing context reported
- **WHEN** required input is absent
- **THEN** the prompt output includes a `missing-context` field listing the absent inputs and no fabricated findings are present

### Requirement: Integration with existing prompt catalog

The frontend UX prompt suite MUST follow WAM's existing prompt conventions (`prompts/index.json` catalog, frontmatter keys) and MUST NOT create a competing system.

#### Scenario: Conventions matched
- **WHEN** the prompt suite is reviewed
- **THEN** frontmatter keys match those in the main prompt index and the manifest is referenced from the catalog

