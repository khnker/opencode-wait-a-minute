# Design — WAM injection block

## Problem

`handleMessage` builds the injection as a flat `inject` array and emits it as
one text part before the completion-validation prompts. History/memory were
already split into `budgetedAux`. Context packs, skills, directives and
delegation are interleaved by construction order, and `emitTextPart` prepends
each part, so multi-part emissions appear in reverse order. The bare `[wam]`
prefix is too weak to delimit the injected region.

## Research / references

- OpenCode `chat.message` hook contract: `output.parts` are rendered in array
  order; WAM's `injectWamParts` uses `position: "prepend"`, so the **last**
  emission becomes the **first** part.
- Anthropic prompt-engineering guidance on long-context ordering: stable,
  high-signal instructions (context, role, constraints) should frame the task
  instructions rather than compete with them.
- OpenAI prompt-structure guidance: delimiters (XML-like tags or explicit
  start/end markers) reduce accidental merging of injected material with user
  content.

## Alternatives considered

### (a) Wrap each emitted part

Wrap every `emitTextPart` call in its own `[wam][start]…[wam][end]` pair.

- Pro: trivially local to `emitTextPart`.
- Con: produces N blocks per turn, still leaves ordering to the prepend
  semantics, and does not solve context/directive interleaving. Tooling must
  scan multiple regions.

### (b) One delimited block per turn (chosen)

Collect all injection fragments into ordered buckets, join them once, wrap the
result, and emit it last.

- Pro: a single recognizable region; deterministic order; one part to locate;
  emission last + prepend means the block lands first.
- Con: larger single part (already budgeted by `applyContextBudget`), so no
  material growth.

## Chosen design

Order inside the block:

1. `contextInject`: N0/N1/N2/N3 pack, coupling pack, cqe file context.
2. `inject`: objective/remaining, inference directive, role directive, pending
   requirements, completion prompt, delegation.
3. `auxInject` (budgeted): history and conversation memory.

`wrapWamBlock` trims the body, returns `""` for empty input, and is idempotent
(does not re-wrap an already delimited body). The block is built before the
`presentValidation` calls and emitted immediately after them, right before
`input.waitAnalysis = analysis`. Because `emitTextPart` prepends, the block
becomes `parts[0]` while the internal order remains
context → directives → aux.

`emitTextPart` keeps the legacy `[wam] ` prefix for ordinary messages and only
skips it when the text already starts with `[wam]`, preventing
`[wam] [wam][start]`.
