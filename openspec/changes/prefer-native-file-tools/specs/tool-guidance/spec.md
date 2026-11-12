# Tool Guidance Specification

## ADDED Requirements

### Requirement: Discovery nudges prefer native tools

WAM discovery nudges SHALL name the native tools (`Read`, `Grep`, `Glob`,
`Edit`/`Write`) before any shell command.

#### Scenario: Bash grep is nudged to the native Grep tool

- **WHEN** a read-only bash command's primary program is `grep` or `rg`
- **THEN** the nudge names the native `Grep` tool
- **AND** it documents `tgrep` only as the secondary fallback

#### Scenario: Bash file reading is nudged to Read

- **WHEN** a read-only bash command's primary program is `cat`, `head`, `tail`
  or `sed`
- **THEN** the nudge names the native `Read` tool

### Requirement: Shell edits are steered to the edit tools

WAM SHALL emit an edit nudge for shell commands that modify files in place.

#### Scenario: sed -i is classified as a shell edit

- **WHEN** `sed` runs with `-i` or `--in-place`
- **THEN** `classifyBash` returns `kind: "justified"` with `shellEdit: true`
- **AND** `nudgeFor` returns the edit nudge naming `Edit`/`Write`

#### Scenario: Unrelated justified commands get no nudge

- **WHEN** the command is a build runner or VCS operation such as `npm test`
- **THEN** `nudgeFor` returns `null`

### Requirement: tgrep is a documented secondary searcher

The guidance SHALL keep `tgrep` (https://github.com/microsoft/tgrep) as a
secondary content-search fallback, never as a runtime dependency.

#### Scenario: Fallback order

- **WHEN** the discovery guidance describes content search
- **THEN** the order is native `Grep`, then `tgrep`

### Requirement: The discovery policy matches native-first guidance

The discovery policy text SHALL NOT recommend shell `grep` as the preferred
search mechanism.

#### Scenario: Policy wording

- **WHEN** `policy.discovery.rules` is loaded
- **THEN** it recommends native tools
- **AND** it does not put `grep` before native tools
