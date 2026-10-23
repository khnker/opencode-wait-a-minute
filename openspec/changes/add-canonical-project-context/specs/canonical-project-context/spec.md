# Canonical Project Context

## ADDED Requirements

### Requirement: Canonical Project Context scope

The system MUST expose a Canonical Project Context (CPC) that contains **only** project-scoped
content. Session-scoped content (task state, transcript, capsules, N2/N3 context, recent
changes) MUST NOT enter the CPC, and the CPC MUST distinguish project scope from session scope
at build time.

#### Scenario: Project memo becomes the CPC source

- **WHEN** the CPC is built from the canonical project memo
- **THEN** every statement is classified as project-scoped content and rendered inside the CPC block

#### Scenario: Session-scoped section is rejected

- **WHEN** the canonical project memo contains a session-scoped section (session, task, recent,
  history, transcript, runtime, capsule, chat)
- **THEN** its statements are excluded from the CPC and recorded as rejected entries

#### Scenario: Session marker inside a canonical section is rejected

- **WHEN** a statement of a canonical section carries a session marker (`sessionId`, `taskId`,
  `task state`, `session.log`, `transcript`, `[wam N2`, `[wam N3`)
- **THEN** the statement is excluded from the CPC and recorded as rejected

#### Scenario: Unknown section is rejected

- **WHEN** the canonical project memo contains a section that is neither a verified-facts
  section nor an assumptions section
- **THEN** its statements are excluded from the CPC instead of being presented as project facts

### Requirement: Verified facts and assumptions separation

The CPC MUST separate verified facts from assumptions. Each statement MUST be classified by its
origin section and MUST be rendered with a distinct label, so that an assumption is never
presented as a verified fact.

#### Scenario: Verified section yields a fact

- **WHEN** a statement belongs to a verified-facts section (stack, facts, decisions,
  constraints, architecture, conventions)
- **THEN** it is rendered as `[wam CPC fact] <statement>`

#### Scenario: Assumed section yields an assumption

- **WHEN** a statement belongs to an assumptions section (inferred, assumed, open questions,
  hypotheses, provisional)
- **THEN** it is rendered as `[wam CPC assumption] <statement>`

#### Scenario: Labels are visible in the injected block

- **WHEN** the CPC is injected
- **THEN** the injected block contains the fact label, the assumption label and no unlabeled statement

### Requirement: Canonical Project Context token budget

The rendered CPC MUST measure strictly fewer than 150 tokens. When the canonical content
exceeds the budget, the system MUST degrade deterministically — assumptions first, then the
least canonical facts, then truncation of the remaining fact — and MUST NOT exceed the limit.
A CPC that still exceeds the budget MUST be rejected instead of injected.

#### Scenario: Oversized memo stays within budget

- **WHEN** the canonical project memo is far larger than the budget
- **THEN** the rendered CPC measures fewer than 150 tokens and validation reports it as valid

#### Scenario: Assumptions are dropped before facts

- **WHEN** the budget is exceeded and both facts and assumptions are present
- **THEN** the assumptions are discarded before any fact, and the remaining facts are preserved

#### Scenario: Out-of-budget CPC is not injected

- **WHEN** validation reports the CPC as exceeding the token budget
- **THEN** the CPC is not injected and the reason is reported

### Requirement: CPC injection at task start

The system MUST inject the CPC when a task starts, as a traceable synthetic part, and the
injection MUST be idempotent: an already present CPC block MUST NOT be duplicated.

#### Scenario: Injection on task start

- **WHEN** a message starts or continues a task and the canonical project memo exists
- **THEN** the CPC block is injected into the output as a synthetic WAM part

#### Scenario: No injection without an active task

- **WHEN** a message arrives without an active task
- **THEN** no CPC block is injected

#### Scenario: Injection is idempotent

- **WHEN** the CPC block is already present in the output
- **THEN** no second CPC block is injected

#### Scenario: Injection failure is non-fatal

- **WHEN** the canonical project memo is missing or unreadable
- **THEN** the hook continues without the CPC and without raising an error

### Requirement: CPC verification coverage

The CPC behavior MUST be covered by an automated test suite that verifies the token budget, the
canonical project content and the absence of session data in the injected block.

#### Scenario: Test suite validates the CPC contract

- **WHEN** the CPC test suite runs
- **THEN** it asserts the token budget, the fact/assumption separation, the rejection of
  session-scoped content, and the idempotence of the injection
