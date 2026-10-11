# Proposal: Runtime Hardening for Release

## Intent

Remove runtime hazards that can pass internal tests while failing on production ESM/package execution path.

## Scope

- eliminate incompatible CommonJS loading from ESM runtime paths;
- validate strategy-continuity execution from clean Node process;
- verify package entry-point loading from packed npm artifact.

## Non-goals

No architecture rewrite. No change to strategy semantics beyond correcting runtime failures.
