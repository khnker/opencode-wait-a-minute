# Tasks

## Phase 1: Skill

- [x] 1.1 Add `skills/verify/SKILL.md` with activation boundary and invariants.
- [x] 1.2 Add `verify` routing metadata to the builtin skill map.
- [x] 1.3 Confirm the skill is discovered and carries embedded content.

## Phase 2: Runtime invariants

- [x] 2.1 Add `src/verification/completion-invariants.js`.
- [x] 2.2 Check malformed state, optional requirements, backlog, and evidence provenance.
- [x] 2.3 Wire the checker into `evaluateCompletionGateStrict`.
- [x] 2.4 Preserve advisory mode and the existing enforce flag semantics.

## Phase 3: Tests

- [x] 3.1 Add skill discovery, registry, and routing tests.
- [x] 3.2 Add invariant tests for optional, cross-session, stale, contradiction,
  strength, backlog, and malformed state.
- [x] 3.3 Add a gate integration test for enforced structured evidence.

## Phase 4: Validation

- [x] 4.1 Run affected tests with `node --test --test-force-exit`.
- [x] 4.2 Run `openspec validate --changes --strict`.
- [x] 4.3 Run `npm run build` and load-check `dist/`.
- [x] 4.4 Run the fresh-session web verification required by `AGENTS.md`.
