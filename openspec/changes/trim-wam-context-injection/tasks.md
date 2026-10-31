# Tasks: Trim WAM first-turn context

## 1. Skill cards
- [x] 1.1 Add `renderSkillCard` and `skillsMaxChars` handling in `src/context/assembly.js`.
- [x] 1.2 Render base skills (`loadStrategy === "base"`) as cards by default; full body only with `skillBaseLoad: "full"` (or `skills.baseLoad`) or `WAM_SKILLS_FULL=1`.
- [x] 1.3 Enforce the absolute N3 budget: on-demand first, base cards dropped first, truncate with `pruneBySection` or skip under 200 chars.

## 2. Single envelope
- [x] 2.1 Merge the CQE summary into the main block; remove the standalone `cqe:` emit at `src/integration/message-handler.js:758` and `:761`.
- [x] 2.2 Merge `presentValidation` lines into the main block; remove the standalone emit at `index.js:2575`.
- [x] 2.3 Keep the phase suffix (`index.js:186`) inside `[wam][start]...[wam][end]`; no part outside the envelope starts with `[wam]`.

## 3. Dedupe
- [x] 3.1 In `src/context/context-dedupe.js`, normalize cqe-prefixed blocks to `cqe:<sorted unique paths>` before hashing; leave other blocks exact-text.

## 4. Tests
- [x] 4.1 `src/context/assembly.test.mjs`: base card, full-body opt-in, absolute cap.
- [x] 4.2 `tests/unit/context-dedupe.test.mjs`: CQE list + summary collapse to one; distinct file sets kept.
- [x] 4.3 `tests/integration/single-envelope.test.mjs`: one `[wam][start]` part, no standalone `[wam]` parts, no `call the task tool with subagent` text.
- [x] 4.4 Synthetic 15,140-char fixture (3 base bodies + 3 on-demand bodies) asserts assembled output <=8,000 chars.

## 5. Validation
- [x] 5.1 `node --test --test-force-exit src/context/assembly.test.mjs tests/unit/context-dedupe.test.mjs tests/integration/single-envelope.test.mjs`
- [x] 5.2 `node scripts/run-tests.mjs`
- [x] 5.3 `openspec validate --changes --strict`
- [x] 5.4 `npm run build` and dynamic-import load check of `dist/`.

## 6. Follow-up: relevance and emission gates
- [x] 6.1 Buffer contract/permission notices and seed `inject` with them so they travel inside the single envelope.
- [x] 6.2 Remove the standalone permission preflight emission; keep only the envelope copy.
- [x] 6.3 Add `scoreSkillDetailed` returning `{ score, signals }`; keep `scoreSkill` delegating.
- [x] 6.4 Reject on-demand skills without a name match or ≥2 distinct non-generic signals (capability/keyword/domain/trigger); generic stoplist terms still score but do not admit.
- [x] 6.5 Surface matched signals in the selected reason.
- [x] 6.6 Require `designSignalCount(prompt) >= 2` or a strong design action before classifying design context.
- [x] 6.7 Skip contract synthesis for question-only prompts (no imperative verb).
- [x] 6.8 Avoid `N3 N3` in the N3 capsule label.
- [x] 6.9 Regression tests for single-generic rejection, two-specific-signal selection, name/trigger admission, cards-only design context, and question-only contracts.
- [x] 6.10 Require explicit confirmation (`explicitYes`) before approving a PROPOSED contract; low uncertainty no longer auto-approves.
- [x] 6.11 Build the approval notice after refreshing state via `getTaskState`, so `nextAction` reflects the approved phase.
