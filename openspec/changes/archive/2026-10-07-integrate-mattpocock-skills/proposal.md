## Why

WAM's skill ecosystem lacks coverage for debugging, TDD, prototyping, and task management workflows. Matt Pocock's 38 skills solve these gaps with proven patterns. License MIT-compatible.

## What Changes

- **Vendor Skills**: Copy 6 mattpocock skills to `skills/` directory
- **Base Skills**: `writing-for-agents`, `codebase-design` always loaded (meta + architecture)
- **On-Demand Skills**: `diagnosing-bugs`, `tdd`, `handoff`, `wizard`, `prototype`, `improve-codebase-architecture`
- **Routing Metadata**: Add `triggers`, `capabilities`, `risk` in `builtinCapabilities` (engine.js)
- **Base Selection**: Skills with `loadStrategy: "base"` bypass scoring, always included first

## Capabilities

### New Capabilities
- `skill-loading`: Unified registry, base/on-demand selection, scoring
- `mattpocock-integration`: Vendor 6 skills, routing, base selection

## Impact
- `src/skills/engine.js` (builtinCapabilities, loadStrategy)
- `src/skills/skill-routing.js` (base constraint handler)
- New: `skills/{diagnosing-bugs,tdd,handoff,wizard,prototype,improve-codebase-architecture}/`
- New: `skills/writing-for-agents/`, `skills/codebase-design/`
- New: `tests/skill-loading.test.mjs`