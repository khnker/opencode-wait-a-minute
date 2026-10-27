## ADDED Requirements

### Requirement: Delimited injection block

Every WAM injection for a turn SHALL be emitted as a single text block whose
first line is `[wam][start]` and whose last line is `[wam][end]`.

#### Scenario: Injection block is emitted

- **WHEN** a task prompt triggers WAM injection
- **THEN** the emitted part starts with `[wam][start]`
- **AND** the last non-empty line of that part is `[wam][end]`

#### Scenario: Empty injection

- **WHEN** no injection fragments are produced
- **THEN** no block is emitted

### Requirement: Deterministic injection order

The injection block SHALL order content as context/skills first, task
directives second, and auxiliary history/memory last.

#### Scenario: Context precedes directives

- **WHEN** the block contains a context pack line such as `[wam N0 ...]` and
  directive or delegation lines
- **THEN** the context line appears before every directive/delegation line

#### Scenario: Auxiliary content is last

- **WHEN** history or conversation memory is injected
- **THEN** it appears after context and directives, immediately before
  `[wam][end]`

### Requirement: Single WAM prefix

The injected block SHALL NOT be double-prefixed.

#### Scenario: Block passes through emitTextPart

- **WHEN** `emitTextPart` receives text that already starts with `[wam]`
- **THEN** it emits the text unchanged instead of prepending another `[wam] `
- **AND** the resulting block never starts with `[wam] [wam][start]`

### Requirement: Block is first in the message parts

The block SHALL be the first WAM part of the message.

#### Scenario: Block emitted last

- **WHEN** the handler emits the block after the completion-validation prompts
- **THEN** prepend semantics place the block at index 0 of `output.parts`
