# plugin-load-compatibility Specification

## ADDED Requirements

### Requirement: Single Function Export Surface
The WAM plugin entry module (`index.js`) MUST expose only plugin functions at module namespace scope. Every export MUST be a function or a `{ server: function }` object, so that opencode's legacy plugin loader (`getLegacyPlugins`) accepts the module. Non-function module-level exports (objects, `Map`s, arrays, primitives) MUST NOT exist.

#### Scenario: Legacy loader accepts every export
- **WHEN** opencode's legacy plugin loader iterates `Object.values` of the entry module namespace
- **THEN** every export is a function (or a `{ server: function }` object)
- **AND** the plugin loads instead of throwing `Plugin export is not a function`

#### Scenario: Non-function export fails the regression gate
- **WHEN** a non-function value is exported from the entry module
- **THEN** `tests/unit/plugin-load.test.mjs` fails, because opencode would throw `Plugin export is not a function`

### Requirement: Internal State Stays Private
Internal coordination state (e.g. the `sessionExecutions` map) MUST NOT be a named export of the entry module. It MAY be attached as a property of the default factory function if external inspection is required, but it MUST NOT appear in the module namespace.

#### Scenario: sessionExecutions is not a module export
- **WHEN** the entry module namespace is inspected
- **THEN** `sessionExecutions` is not present as a named export
- **AND** the internal map is still created and used by the plugin runtime
