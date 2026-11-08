# skill-loading — delta

## ADDED Requirements
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
