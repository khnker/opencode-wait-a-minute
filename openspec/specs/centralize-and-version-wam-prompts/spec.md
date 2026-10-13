# centralize-and-version-wam-prompts Specification

## Purpose
TBD - created by archiving change centralize-and-version-wam-prompts. Update Purpose after archive.
## Requirements
### Requirement: Centralized Agent-Directed Strings
WAM MUST store every agent-directed literal (nudges, warnings, notices, injected guidance) in Markdown files under `prompts/`, grouped by domain, each with a dedicated file and metadata frontmatter.

#### Scenario: Inspecting centralized prompts
- GIVEN the repository root has a `prompts/` directory
- WHEN listing prompt files
- THEN each migrated string resides in its own Markdown file with metadata and body.

### Requirement: Machine-Readable Prompt Catalog
The system MUST provide `prompts/index.json` indexing all active prompts with `id`, `path`, `status`, `consumers`, and `testRefs`.

#### Scenario: Validating prompt catalog
- GIVEN `prompts/index.json` and prompt Markdown files
- WHEN running `npm run prompts:check`
- THEN duplicate ids, missing paths, unregistered files, and invalid references are reported and the command exits non-zero on error.

### Requirement: Runtime Prompt Loading
The runtime MUST load prompts from Markdown with stable path resolution and `{{var}}` interpolation, preserving current behavior.

#### Scenario: Loading a prompt with variables
- GIVEN a registered prompt id with required interpolation variables
- WHEN loaded via the prompt loader
- THEN the exact prior string is returned with variables substituted.

#### Scenario: Variable is missing
- GIVEN a prompt requiring a variable that is not supplied
- WHEN loaded
- THEN the loader raises a diagnostic error instead of returning an empty/partial prompt.

#### Scenario: Unknown id or missing file
- GIVEN an unregistered id or an absent file
- WHEN loaded
- THEN the loader raises a diagnostic error.

### Requirement: Behavior Preservation
Migration MUST NOT change the effective strings or their interpolation.

#### Scenario: Characterization equivalence
- GIVEN characterization tests capturing pre-migration strings
- WHEN the code loads from `prompts/`
- THEN outputs match byte-for-byte for static prompts and for the same variable values.

### Requirement: Prompt Tooling
The system MUST provide `npm run prompts:check` (validates catalog + metadata + paths + refs + no unregistered active prompts) and `npm run prompts:list` (inventory of id/status/consumers).

#### Scenario: Listing prompts
- GIVEN the catalog exists
- WHEN running `npm run prompts:list`
- THEN each prompt id, status, and consumers are printed.

