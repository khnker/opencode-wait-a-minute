# WAM config spec delta

## ADDED Requirements

### Requirement: Configuration precedence

WAM MUST resolve configuration with the following precedence, highest first:
environment variables (`WAM_*`), the project file
`<projectRoot>/.wam/config.json`, the global config file, and built-in defaults.

#### Scenario: Environment overrides all files

- **WHEN** `WAM_SKILLS=false` is set and both the global and project files set
  `skills` to `true`
- **THEN** the effective `skills` value is `false`

#### Scenario: Project overrides global

- **WHEN** the global file sets `logging` to `false` and the project file sets
  `logging` to `true`
- **THEN** the effective `logging` value is `true`

#### Scenario: Missing global falls back

- **WHEN** the resolved global config file does not exist
- **THEN** loading succeeds and only the project file and defaults apply

### Requirement: Global config path resolution

WAM MUST resolve the global config path by using `WAM_GLOBAL_CONFIG` when set
and non-empty, otherwise `$XDG_CONFIG_HOME/wam/config.json` when
`XDG_CONFIG_HOME` is set, otherwise `path.join(os.homedir(), ".config", "wam",
"config.json")`.

#### Scenario: Explicit override wins

- **WHEN** `WAM_GLOBAL_CONFIG=/tmp/custom/config.json` and
  `XDG_CONFIG_HOME=/tmp/xdg` are set
- **THEN** WAM reads `/tmp/custom/config.json`

#### Scenario: XDG default

- **WHEN** `WAM_GLOBAL_CONFIG` is unset and `XDG_CONFIG_HOME=/tmp/xdg`
- **THEN** WAM reads `/tmp/xdg/wam/config.json`

#### Scenario: Home fallback

- **WHEN** neither `WAM_GLOBAL_CONFIG` nor `XDG_CONFIG_HOME` is set
- **THEN** WAM reads `<home>/.config/wam/config.json`

### Requirement: Deep merge of global and project config

WAM MUST recursively merge plain objects from the global file and then the
project file, with project values winning. Arrays and scalars MUST replace
rather than merge.

#### Scenario: Nested objects combine

- **WHEN** the global file contains `taskLoop.agents.enabled = true` and the
  project file contains `taskLoop.agents.maxRevisionCycles = 4`
- **THEN** the effective config has both values applied

#### Scenario: Scalar replaces

- **WHEN** the global file sets `debug = false` and the project file sets
  `debug = true`
- **THEN** the effective `debug` value is `true`

#### Scenario: Array replaces

- **WHEN** the global and project files both define an array value
- **THEN** the project array is used in full, with no concatenation

### Requirement: WAM_CONFIG suppresses the global file

WAM MUST treat `WAM_CONFIG` as a complete config-file location override. When
`WAM_CONFIG` is set, the global file MUST NOT be read or merged.

#### Scenario: Only WAM_CONFIG is used

- **WHEN** `WAM_CONFIG=/tmp/config.json` is set and the resolved global file
  contains different values
- **THEN** only `/tmp/config.json` and environment variables affect the
  effective config

### Requirement: Global config fails soft

WAM MUST treat a missing, unreadable, malformed, or non-object global config
file as `{}` and MUST NOT throw.

#### Scenario: Malformed global JSON

- **WHEN** the global file contains invalid JSON
- **THEN** loading succeeds using project config, environment, and defaults

#### Scenario: Non-object global root

- **WHEN** the global file contains a JSON array or scalar
- **THEN** the global config is treated as `{}`
