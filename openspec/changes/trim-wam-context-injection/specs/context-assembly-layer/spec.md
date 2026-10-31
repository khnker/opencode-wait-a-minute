# Spec: context-assembly-layer (trim-wam-context-injection)

## ADDED Requirements

### Requirement: Base skills render as bounded cards by default

The system MUST render a base skill as a card of at most 400 characters
containing its id, a description of at most 160 characters, and the path to its
`SKILL.md`. The full body SHALL be injected only when `skillBaseLoad` (or
`skills.baseLoad`) is `"full"`, or when `WAM_SKILLS_FULL=1`.

#### Scenario: Cold session

- **GIVEN** a session with no injected skills
- **WHEN** `assembleContext` selects a base skill
- **THEN** the N3 block contains the card
- **AND** it does not contain the full `SKILL.md` body

#### Scenario: Explicit full-body opt-in

- **GIVEN** `skills.baseLoad` is `"full"` or `WAM_SKILLS_FULL=1`
- **WHEN** `assembleContext` selects a base skill
- **THEN** the N3 block contains the full body up to the configured cap

### Requirement: N3 has an absolute character budget

The total N3 skill content MUST NOT exceed `skillsMaxChars` (default 4,000)
even when the 40 % flex budget is larger. On-demand skills SHALL be rendered
before base cards, and base cards SHALL be dropped first when the budget is
reached.

#### Scenario: Budget exhausted

- **GIVEN** on-demand skills fit but base cards do not
- **WHEN** `assembleContext` renders N3
- **THEN** the on-demand skills are present
- **AND** the base cards that do not fit are omitted or truncated

#### Scenario: On-demand skill content

- **GIVEN** an on-demand skill is selected
- **WHEN** it is rendered
- **THEN** its body is capped at the existing per-skill limit (1,200 chars)

### Requirement: One WAM envelope per request

All synthetic WAM context (N0-N3, CQE and contract status) MUST be emitted
inside a single `[wam][start]...[wam][end]` block. No other part of the same
request SHALL start with `[wam]`, and CQE and contract status SHALL appear once.

#### Scenario: Message with CQE and a proposed contract

- **GIVEN** a request that triggers CQE and a proposed contract
- **WHEN** the message is handled
- **THEN** exactly one part starts with `[wam][start]`
- **AND** no standalone `cqe:` or `[wam] Intervención activa` part is emitted
- **AND** the CQE summary and contract status are present once inside the envelope

### Requirement: CQE blocks dedupe by file set

The dedupe layer MUST normalize a block whose first line starts with `cqe:` or
`[wam cqe` to a key derived from its sorted, unique file paths, so the file list
and the summary of the same result dedupe together. Blocks with different file
sets SHALL both be kept.

#### Scenario: Same result in two formats

- **GIVEN** a session that received `[wam cqe file_context: N archivos ...]`
- **WHEN** the `cqe: N archivos ... — top: ...` summary is assembled
- **THEN** the summary is not injected again

#### Scenario: Different results

- **GIVEN** a session that received a CQE block for files A and B
- **WHEN** a CQE block for files C and D is assembled
- **THEN** both blocks are kept

### Requirement: No delegation instructions in WAM output

WAM MUST NOT emit subagent delegation text. The assembled context SHALL NOT
contain the phrase `call the task tool with subagent`.

#### Scenario: Delegation prompt present in the user message

- **GIVEN** a user message that contains a delegation instruction
- **WHEN** WAM assembles its synthetic context
- **THEN** the WAM envelope does not repeat or contain that instruction

### Requirement: On-demand skills need a name match or two specific signals

An on-demand skill MUST be selected only when the prompt matches its name, or at
least two distinct scoring signals (description phrase, capability, keyword,
domain, trigger) whose matched prompt terms are non-generic. Generic terms (a
bounded stoplist such as `context`, `cards`, `skills`, `create`, `for`,
`workflow`, `component`, `action`) MAY contribute to the score but MUST NOT
count toward admission. Base skills (`loadStrategy: "base"`) MUST bypass
scoring and always be selected.

#### Scenario: Generic-only keywords

- **GIVEN** a skill whose only keywords are `create` and `for`
- **WHEN** the prompt is `create a card component for the dashboard`
- **THEN** the skill is rejected
- **AND** the rejection reason names the insufficient signals

#### Scenario: Single generic keyword

- **GIVEN** a prompt containing only `workflow`
- **WHEN** `routeSkillsV2` scores a skill whose only keyword is `workflow`
- **THEN** the skill is rejected

#### Scenario: Name match

- **GIVEN** a skill whose name appears in the prompt
- **WHEN** `routeSkillsV2` scores the skill
- **THEN** the skill is selected even without a second signal

#### Scenario: Two specific signals

- **GIVEN** a prompt matching a skill's specific capability `debug` and trigger
  `broken`
- **WHEN** `routeSkillsV2` scores the skill
- **THEN** the skill is selected
- **AND** its reason lists both matched signals

#### Scenario: Single specific keyword

- **GIVEN** a skill whose only matched term is one specific keyword (`arch` or
  `log`)
- **WHEN** no name match or second signal (capability, domain, trigger) exists
- **THEN** the skill is rejected

### Requirement: Design context needs two design signals

`classifyDesignTask` MUST return `null` unless the prompt has at least two
distinct design terms or a strong design action (`redesign`,
`design system`, `accessibility`, `a11y`, `responsive`).

#### Scenario: Skill display prompt with `cards`

- **GIVEN** a prompt about rendering `cards` inside a skill block
- **WHEN** `assembleContext` runs
- **THEN** it emits neither `[wam design context]` nor `[wam design budget]`

#### Scenario: Real UI request

- **GIVEN** a prompt such as `create the dashboard page`
- **WHEN** `assembleContext` runs
- **THEN** it emits `[wam design context]` and `[wam design budget]`

### Requirement: Question-only prompts create no requirements

`synthesizeContract` MUST return an empty `requirements` list for a prompt that
contains a question mark and no imperative action verb.

#### Scenario: Question without a request

- **GIVEN** the prompt `¿Cómo funciona el router de contexto?`
- **WHEN** `synthesizeContract` runs
- **THEN** `requirements` is empty and `trivial` is `true`

#### Scenario: Question plus imperative

- **GIVEN** the prompt `¿Falla el build? arréglalo`
- **WHEN** `synthesizeContract` runs
- **THEN** `requirements` is not empty

### Requirement: Synthetic notices appear only inside the envelope

All synthetic notices MUST be rendered inside the single
`[wam][start]...[wam][end]` block: contract approval/rejection, the approval
question, and the permission preflight. No normal-turn synthetic notice SHALL be
emitted as a separate `[wam]` part.

#### Scenario: Contract approval

- **GIVEN** a pending contract and a confirming prompt
- **WHEN** the message handler emits the turn
- **THEN** the `Contrato aprobado` notice appears inside the envelope
- **AND** no standalone part starts with `[wam]`

### Requirement: Contract approval requires explicit confirmation

A PROPOSED contract MUST NOT be approved unless the prompt starts with an
explicit confirmation token. Low uncertainty alone SHALL NOT count as
confirmation. After approval, the emitted notice MUST use the refreshed
`nextAction` from persisted state.

#### Scenario: Non-confirming prompt keeps contract proposed

- **GIVEN** a PROPOSED contract and a prompt without an explicit confirmation
- **WHEN** the message handler emits the turn
- **THEN** the contract remains `PROPOSED`
- **AND** no `Contrato aprobado` notice is emitted

#### Scenario: Explicit confirmation emits post-refresh notice

- **GIVEN** a PROPOSED contract and a prompt starting with `si`/`sí`/`ok`
- **WHEN** the message handler approves and emits the turn
- **THEN** the notice's `Próximo paso` matches the refreshed `nextAction`
- **AND** the notice does not contain `Revisar contrato`
