# Design: Trim WAM first-turn context and dedupe synthetic parts

## Context
Skill injection runs in `src/context/assembly.js` (N3). Base skills bypass
scoring in `src/skills/engine.js:475-479` and are always selected. Cross-turn
dedupe already exists (`dedupe-skill-injection-and-dispatch-noise`,
`injectedSkills` -> `[wam N3 skill-ref]`), but it only helps turns 2+ of the
same session. A subagent session starts cold, so the first turn carries every
base skill body in full.

The 2026-10-28 dump shows the result: 15,140 chars in one user block, 11.8 KB of
skill bodies, and three extra `[wam]` parts repeating CQE/contract data.

## Research
- Anthropic, *Effective context engineering for AI agents*:
  https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
  Takeaway: load metadata first, load the body only when the task needs it;
  context should be minimal, dynamic and task-adjacent.
- Anthropic, *Agent Skills overview*:
  https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
  Takeaway: progressive disclosure is the intended skill model (name +
  description first, body on demand).
- Chroma, *Context Rot*: https://research.trychroma.com/context-rot
  Takeaway: duplicated and bloated context degrades reasoning; dedupe and
  bound what is injected.
- Liu et al., *Lost in the Middle*: https://arxiv.org/abs/2307.03172
  Takeaway: information buried in the middle of a long context is used less;
  smaller, well-ordered blocks are safer.
- Existing WAM changes: `bound-context-noise` caps N1/N2; `add-context-curation`
  adds dedupe/compaction; `dedupe-skill-injection-and-dispatch-noise` adds
  cross-turn skill refs and `minSkillScore`. None bounds the first-turn skill
  body or merges the standalone `[wam]` parts.

## Alternatives considered
| Option | Result | Verdict |
|---|---|---|
| A. Lower `skillContentMax` for base skills to 1,200 | Smaller, but still ships irrelevant body and truncates useful on-demand skills | Rejected |
| B. Metadata-first cards for base skills + full body for matched on-demand skills | Large saving, keeps discoverability, aligns with progressive disclosure | **Chosen** |
| C. Drop base skills entirely | Maximum saving, but breaks the product guarantee and the agent loses design conventions | Rejected (also rejected in the prior change) |
| D. Rely only on existing cross-turn dedupe | Helps turns 2+, not the cold first turn that caused the incident | Rejected as sole fix |

## Decisions
1. **Base skill card.** A base skill (`loadStrategy === "base"`) renders as:
   ```
   [wam N3 skill-ref] <id> — <description, first sentence, <=160 chars>
     load: read <path>
   ```
   capped at 400 chars. Full body only when `skillBaseLoad: "full"` (or
   `skills.baseLoad`, since `skills` is normally a boolean) is set in
   `.wam/config.json`, or when `WAM_SKILLS_FULL=1`.
2. **Absolute skill budget.** `skillsMaxChars` (default 4,000, configurable)
   bounds the whole N3 block in addition to the existing 40 % flex budget:
   `effective = min(skillBudget, skillsMaxChars)`. On-demand skills are rendered
   first; base cards are dropped first when the cap is reached. A skill that
   does not fit is truncated with `pruneBySection` or skipped if <200 chars
   remain.
3. **Single envelope.** All synthetic context (N0-N3, CQE, contract status)
   goes inside the existing `[wam][start]...[wam][end]` block. The standalone
   `cqe:` part (`src/integration/message-handler.js:758`) and the standalone
   validation part (`index.js:2575`) are removed; their lines are merged into
   the main block. The phase suffix at `index.js:186` must remain inside the
   envelope, not as a separate part.
4. **CQE dedupe by file set.** `src/context/context-dedupe.js` normalizes a
   block whose first line starts with `cqe:` or `[wam cqe` by extracting the
   file paths, sorting and uniquing them, and hashing `cqe:<paths>`. The file
   list and the summary therefore share one key and only the first is injected.
   Non-CQE blocks keep the exact-text hash.
5. **No invented command.** The card points to `read <path>`; there is no
   `/wam skill <id>` command in the CLI, so the design does not promise one.
6. **External text is out of scope.** The phrase
   `Use the above message and context...` is not in this repo and is not
   emitted by WAM. A guard test only asserts that WAM never emits it; the source
   block is left untouched.

## Data flow
`handleMessage` -> `assembleContext` builds one string:
```
[wam][start]
... N0/N1/N2 ...
... skill cards (base) + on-demand bodies ...
... cqe summary + file_context ...
... contract status (once) ...
[wam][end]
```
`handleMessage` emits that string once. No other `emitTextPart` call may start
with `[wam]` for the same request.

## Risks and mitigations
- **Agent skips a base skill it needed.** The card states the path and a
  one-line trigger; base skills are conventions, not procedures. Escape hatch:
  `skills.baseLoad: "full"` or `WAM_SKILLS_FULL=1`.
- **Over-aggressive CQE dedupe.** Normalization only applies to cqe-prefixed
  blocks; unit tests cover two different file sets (kept) and one file set in
  two formats (deduped).
- **UI/tests expect the standalone parts.** Update affected tests; the data
  remains available inside the envelope.
- **Budget starves a high-value skill.** On-demand skills are rendered before
  base cards, so the cap only removes always-on cards first.

## Validation
- `node --test --test-force-exit src/context/assembly.test.mjs tests/unit/context-dedupe.test.mjs tests/integration/single-envelope.test.mjs`
- Synthetic fixture with 3 base bodies (5.8 KB, 3.1 KB, 0.4 KB) and 3 on-demand
  bodies (1.2 KB each): assembled output MUST be <=8,000 chars.
- `openspec validate --changes --strict`
- `npm run build` and a `dist/` dynamic-import load check.

## Follow-up (2026-10-28)

The first implementation still leaked separate notices and selected on-demand
skills from a single generic keyword. The fixes choose structural gates over
threshold tuning.

### Skill relevance

- **Threshold-only `minSkillScore` (rejected).** IDF inflates one rare keyword
  (`context` → 20.04, `cards` → 19.54), so any threshold that rejects the false
  positive also rejects legitimate single-signal matches.
- **Single specific signal (rejected).** Requiring only `signals.size > 0`
  admitted a skill on one term, so ordinary prompts selected irrelevant skills:
  `"create a card component for the dashboard"` selected 5 unrelated skills
  (`pr-dashboard`, `oo-component-documentation`,
  `react-container-presentation-component`, …), and
  `"debug this broken service"` selected `flowstudio-power-automate-debug` and
  `git-flow-branch-creator`. One common word is not evidence of task relevance.
- **Name OR ≥2 distinct non-generic signals + bounded stoplist (chosen).**
  `GENERIC_SKILL_TERMS` marks common English/log-domain words (including
  `component`, `card`, `flow`, `workflow`, `analysis`, `action`, `review`).
  Signals come from name, description phrase, capability, domain, keyword, and
  `triggers`. Generic terms still contribute to `score`, but never count toward
  admission; a skill with neither a name match nor two distinct signals is
  rejected. This keeps a real capability + trigger pair (`debug` + `broken`) or
  two genuine keywords (`arch` + `linux`) while rejecting one-word matches and
  two generic keywords (`create` + `for`). Base skills still bypass scoring and
  are always selected. Residual risk: the stoplist is heuristic — a generic
  word outside it can still contribute a signal, and a domain term that happens
  to be listed is ignored for admission (it still scores).

### Design context

- **Classifier-only heuristics (rejected).** `classifyDesignTask` matched any
  single design-ish word (`cards`), so the design block fired on skill-display
  prompts.
- **Require `designSignalCount(prompt) >= 2` (chosen).** Multiple design terms,
  or one explicit design action (`redesign`, `design system`, `accessibility`,
  `a11y`, `responsive`), are needed before injecting design context.

### Contract synthesis

- **Keep the raw prompt as the fallback requirement (rejected).** A question
  becomes `req-1` with the whole text, duplicating in `next:` and `user_decided`.
- **Skip requirements for question-only prompts (chosen).** A prompt with `?`
  or `¿` and no imperative verb is trivial; an explicit request (`¿falla?
  arréglalo`) still wins because the imperative verb is present.

### Notice emission

- **Separate `[wam]` parts per notice (rejected).** Contract approval/rejection,
  the approval question, and the permission preflight escaped the envelope.
- **Single envelope (chosen).** Early notices are buffered and seed `inject`, so
  every normal-turn synthetic notice is rendered once inside `wrapWamBlock`.

## Follow-up (2026-10-29)

**Problem.** Any non-high-uncertainty prompt (e.g. `falta algo?`) satisfied
`userConfirms = !highUncertainty || explicitYes`, so a PROPOSED contract was
auto-approved. The approval notice was then built from the pre-approval
`state.nextAction`, emitting the stale `Revisar contrato — /wam contract approve
o edit` while the refreshed state was already approved.

**Rejected: auto-approve on low uncertainty.** Cheap, but it mutates the
contract without user intent and leaves the notice contradicting N2 state.

**Chosen: explicit confirmation + notice post-refresh.** `userConfirms` is now
`explicitYes`; after `approveContract` the handler refreshes `state` via
`getTaskState` and only then composes `skillsLine` and the notice. The
`recordDecision` source is `user-decided` because approval now requires an
explicit user signal.
