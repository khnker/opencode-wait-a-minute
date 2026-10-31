# Change: Trim WAM first-turn context and dedupe synthetic parts

## Objective
Cut the synthetic context WAM injects on the first turn of a session from ~15 KB
to <=8 KB without losing task-relevant instructions, and guarantee that CQE and
contract status appear once.

## Why
Evidence from a real subagent request (`/home/nicolas/dev/with`, 2026-10-28):

- user message block 0: **15,140 chars**;
- `[wam N3 skill]` bodies: **~11.8 KB** for 6 skills, 3 of them base skills
  (`codebase-design` ~5.8 KB, `ponytail` ~3.1 KB);
- the same CQE/status data is repeated in 3 extra `[wam]` parts
  (583 + 56 + 177 chars);
- `presentValidation` repeats `skills activas`, `requisitos` and `Plan:`
  already present in the main block;
- `[wam cqe file_context]` (file list) and the standalone
  `cqe: N archivos...` part carry the same information in two formats.

Root causes:

- base skills always inject their full body up to 8,000 chars
  (`src/context/assembly.js:560`); on-demand skills up to 1,200;
- the skill budget is 40 % of flex with no absolute cap
  (`src/context/assembly.js:546`);
- dedupe hashes exact text (`src/context/context-dedupe.js:77`), so the CQE file
  list and the CQE summary never collide;
- diagnostics are emitted as separate text parts
  (`src/integration/message-handler.js:758`, `index.js:2575`, `index.js:186`).

## What changes
- **Progressive skill disclosure**: base skills inject a compact card (id,
  description, path, retrieval command) by default; the full body is injected
  only on explicit request or with `WAM_SKILLS_FULL=1`.
- **Absolute skill budget** (default 4,000 chars): on-demand skills first, then
  base cards; drop the lowest-relevance item when the cap is reached.
- **Single WAM envelope**: N0-N3, CQE and contract status live inside
  `[wam][start]...[wam][end]`; no standalone `[wam]` parts.
- **CQE dedupe by file set** instead of the timing string, and render the CQE
  summary once.
- **Regression test** built from the captured 15,140-char case: assembled
  context MUST be <=8,000 chars for the same input.

## Non-goals
- Does not change N0/N1/N2 admission, the base-skill set, or the 40 % flex
  allocation.
- Does not touch Omniroute memory (separate fix already applied: memory
  injection disabled and 14 contaminated entries purged).
- Does not remove the external delegation text
  (`Use the above message and context...`); it was traced outside the WAM repo
  and is not emitted by WAM.

## Impact
- ~50 % less synthetic context on the first turn of every subagent session.
- Three fewer OpenCode parts per request.
- Base skills stay discoverable through the card and `/wam skill <id>`.
