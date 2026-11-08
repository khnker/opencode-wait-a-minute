# skill-loading Specification

## Purpose
TBD - created by archiving change integrate-mattpocock-skills. Update Purpose after archive.
## Requirements
### Requirement: Base Skills Always Loaded

WAM SHALL always load skills whose `loadStrategy` is `"base"` at startup, regardless of prompt match score.

#### Scenario: Base skill in registry
- GIVEN skill "writing-for-agents" has `loadStrategy: "base"`
- WHEN `routeSkillsV2` is called
- THEN "writing-for-agents" SHALL appear in selected skills
- AND score SHALL NOT be used as filter for base skills

#### Scenario: Base skill conflicts with on-demand
- GIVEN base skill "codebase-design" and on-demand skill "improve-codebase-architecture" both match
- THEN both SHALL be selected (no mutual exclusion)

### Requirement: On-Demand Skill Scoring

WAM SHALL score on-demand skills via `scoreSkill()` using trigger/capability matches against the user prompt.

#### Scenario: Trigger match
- GIVEN skill "diagnosing-bugs" with trigger "diagnose"
- WHEN prompt contains "diagnose this bug"
- THEN score SHALL include trigger weight

### Requirement: Skill Metadata Extension

WAM SHALL extend `builtinCapabilities` entries with `loadStrategy` field (`"base"` or `"ondemand"`). Missing field defaults to `"ondemand"`.

#### Scenario: Entry has loadStrategy = "base"
- GIVEN a skill entry with `loadStrategy: "base"` in `builtinCapabilities`
- WHEN `buildSkillRegistry` processes the entry
- THEN `registry[skill].loadStrategy` SHALL be `"base"`
- AND `routeSkillsV2` SHALL always include the skill in `selected`

#### Scenario: Entry lacks loadStrategy
- GIVEN a skill entry with no `loadStrategy` field
- WHEN `buildSkillRegistry` processes the entry
- THEN `registry[skill].loadStrategy` SHALL default to `"ondemand"`

### Requirement: Agentic code foundations skill is discoverable and routable
The bundled local skill `agentic-code-foundations` SHALL be discovered from
`skills/<id>/SKILL.md`, registered as APPROVED with on-demand loading, and selected for
refactor/maintainability prompts.
#### Scenario: Skill discovered from the bundled skills directory
- **WHEN** `discoverSkills({ root: process.cwd() })` runs
- **THEN** the result contains `agentic-code-foundations`
- **AND** its path ends with `skills/agentic-code-foundations/SKILL.md`
#### Scenario: Registry entry is approved and on demand
- **WHEN** the registry is built from discovered skills
- **THEN** the entry status is `APPROVED`
- **AND** `risk` is `low`
- **AND** `loadStrategy` is `ondemand`
- **AND** capabilities and triggers are non-empty
#### Scenario: Refactor prompt selects the skill
- **WHEN** a prompt asks to refactor code for maintainability and agent-readable clarity
- **THEN** `routeSkillsV2` selects `agentic-code-foundations`
- **AND** the skill is not marked as a base skill
#### Scenario: Constraint allows every layer
- **WHEN** the skill constraint is read
- **THEN** `allowedLayers` includes backend, frontend, shared and infrastructure

### Requirement: Craftsman skill is discoverable and routable
The bundled local skill `craftsman` SHALL be discovered from `skills/<id>/SKILL.md`,
registered as APPROVED with on-demand loading, and selected for implementation and
refactoring prompts.
#### Scenario: Skill discovered from the bundled skills directory
- **WHEN** `discoverSkills({ root: process.cwd() })` runs
- **THEN** the result contains `craftsman`
- **AND** its path ends with `skills/craftsman/SKILL.md`
#### Scenario: Registry entry is approved and on demand
- **WHEN** the registry is built from discovered skills
- **THEN** the entry status is `APPROVED`
- **AND** `risk` is `low`
- **AND** `loadStrategy` is `ondemand`
- **AND** capabilities and triggers are non-empty
#### Scenario: Implementation prompt selects the skill
- **WHEN** a prompt asks to implement or refactor code following software design principles
- **THEN** `routeSkillsV2` selects `craftsman`
- **AND** the skill is not marked as a base skill
#### Scenario: Constraint allows every layer
- **WHEN** the skill constraint is read
- **THEN** `allowedLayers` includes backend, frontend, shared and infrastructure

### Requirement: Selected on-demand skill bodies reach N3
The context assembler SHALL preserve each retained Markdown section body when pruning a
skill that exceeds its per-skill cap, and SHALL keep the synthetic `[wam N3 skill]` header.

#### Scenario: Section bodies are preserved when pruning
- **WHEN** a Markdown skill exceeds the on-demand per-skill cap
- **THEN** each retained section includes its body up to the next heading
- **AND** the synthetic skill header remains in the injected line

#### Scenario: Craftsman ladder body is injected
- **WHEN** `craftsman` is selected for an implementation or refactor prompt
- **THEN** the `[wam N3 skill] craftsman` line contains `CRAFTSMAN LADDER`, `RUNG-1` and `EVALUATE`

### Requirement: Skill body injection has no fixed character cap
The context assembler SHALL inject the complete skill body by default and SHALL bound
it only by the remaining skill token budget or an explicit `skillsMaxChars`.

#### Scenario: Long on-demand skill is injected whole
- **WHEN** a selected on-demand skill is longer than 4000 characters and fits the skill token budget
- **THEN** the injected line contains the complete skill body
- **AND** its state is `INJECTED`, not `TRUNCATED`

#### Scenario: Base full-body mode is not capped at 8000
- **WHEN** a base skill exceeds 8000 characters
- **THEN** its full body is injected without truncation

### Requirement: Skills may use up to 80% of remaining flex
The context assembler SHALL allocate at most 80% of remaining flex to skill injection
and SHALL reserve the remaining 20% for design and other optional context.
#### Scenario: Skill exceeds the former 40% share
- **WHEN** selected skill content fits within 80% of remaining flex but exceeds 40%
- **THEN** the skills are injected without truncation
- **AND** flex remains available for other context

### Requirement: Base skills inject full bodies by default
The context assembler SHALL inject the complete body of a selected base skill unless
the project explicitly opts into cards with `skillBaseLoad: "card"`.

#### Scenario: Base skill body is the default
- **WHEN** a base skill is selected and no `skillBaseLoad` is configured
- **THEN** the `[wam N3 skill]` line contains the full base body

#### Scenario: Card opt-out remains available
- **WHEN** `.wam/config.json` sets `skillBaseLoad: "card"`
- **THEN** the base skill renders as a compact `[wam N3 skill-ref]` card

#### Scenario: Explicit skillsMaxChars still applies
- **WHEN** `.wam/config.json` sets `skillsMaxChars`
- **THEN** injected skill lines respect that character limit

