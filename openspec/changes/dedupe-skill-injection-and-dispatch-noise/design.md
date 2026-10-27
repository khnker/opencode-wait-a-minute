# Design: Dedupe skill injection and quiet dispatch noise

## Research
- Skill injection lives in `src/context/assembly.js:482-597`; selection in
  `src/skills/engine.js:834-900`.
- Scoring weights: name 5, capability 4·idf, keyword 3·idf, description 2,
  domain 1·idf. A single generic keyword hit scores 3.
- Task ids are derived in `index.js:403-438`; subagent sessions are known from
  `sessionParents` in `index.js`.

## Decision
1. **Cross-turn refs**: `assembleContext` accepts `injectedSkills` (Set of skill
   ids). If the id was already injected in the session, emit a one-line
   `[wam N3 skill-ref] <id> — already injected this session` instead of the body.
   `handleMessage` keeps the per-session set.
2. **Threshold**: `_routeSkillsV2Impl` drops candidates with `score < 4`
   (`minSkillScore`, configurable). Base skills bypass scoring.
3. **Dispatch noise**: when the session has a `parentID`, `effectiveTaskId` skips
   prompt-slug derivation and falls back to the session id, so dispatches do not
   become `task-<dispatch-slug>`.

## Alternatives considered
- **Global skill cache in the registry**: rejected; caching in the registry
  would leak across sessions and projects.
- **Disable base skills**: rejected; they are a product guarantee.
- **Rewrite the dispatch prompt**: rejected; the orchestrator owns the prompt,
  WAM should not mutate it.

## Risks
- A later turn that genuinely needs a different section of the same skill gets
  only the ref. Mitigation: the ref is explicit and the skill id is retrievable.
- Threshold 4 may drop low-signal but useful skills; it is configurable.
