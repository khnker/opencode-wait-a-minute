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

