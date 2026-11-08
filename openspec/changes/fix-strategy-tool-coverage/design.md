# Design: Fix strategy tool coverage and orphan execution gates

## Research

- OpenCode plugin hooks (`tool.execute.before`) receive `input.tool` plus the
  call arguments; the tool name is the stable identity for built-in tools:
  <https://opencode.ai/docs/plugins/>
- Capability-based authorization should be explicit and deny by default for
  unknown *privileged* operations, while ordinary read-only tools must not be
  mistaken for privileged actions (Saltzer & Schroeder, "The Protection of
  Information in Computer Systems"; OWASP ASVS authorization guidance):
  <https://owasp.org/www-project-application-security-verification-standard/>
- Node's built-in test runner (`node:test`) and `new Function` extraction are
  already used by `tests/unit/autonomy-behavior-suite.test.mjs`; the fallback
  body must therefore remain self-contained.

## Decision 1 — How to stop false violations for ordinary tools

**Options**

1. Expand the default `allowedActions` with the missing host tools. *(chosen)*
2. Fail open for any tool that is not explicitly prohibited.
3. Derive the allowlist dynamically from a host tool registry.

**Rationale**

- Option 2 weakens the fail-closed contract: an unknown privileged tool would
  silently pass. It also breaks the existing capability tests asserting
  `npm publish` is not covered by `npm test`.
- Option 3 is not portable: OpenCode does not expose one stable registry across
  versions, and MCP tool names are arbitrary. It would add coupling for no
  benefit in this change.
- Option 1 is the smallest complete fix and keeps the deny-by-default model.

## Decision 2 — How to fix the fallback classifier

**Options**

1. Build the candidate from the derived `executable` + `argv`. *(chosen)*
2. Delete the fallback and always use the imported classifier.
3. Duplicate the full `matchesCapability` implementation in the fallback.

**Rationale**

- Option 2 breaks `autonomy-behavior-suite.test.mjs`, which extracts the
  function body with `new Function` and cannot see module imports.
- Option 3 duplicates logic and will drift from `strategy-capabilities.js`.
- Option 1 reuses the values already computed at the top of the function and
  keeps the fallback self-contained.

## Decision 3 — When to release a same-process execution gate

**Options**

1. Release when the loop status is terminal and no pass is in flight. *(chosen)*
2. Always release same-process gates on the next tool call.
3. Keep relying on the next turn/idle event.

**Rationale**

- Option 2 reintroduces the race the gate protects against: a pass could be
  running while the main session mutates files.
- Option 3 leaves mutations blocked for the remainder of the turn after
  `STOP_STAGNATION`/`COMPLETED`, which is the reported symptom.
- Option 1 uses the authoritative signals (`loop-state.status` and
  `agentRunInFlight`) and keeps the existing "blocks while RUNNING" behavior.

## Risks

- A stale `loop-state.json` from a previous attempt could be terminal while a
  new pass is starting; the `agentRunInFlight` guard prevents releasing the
  gate in that window.
- New host tools added by future OpenCode releases will still require an
  allowlist entry; the fail-closed default is intentional.
