# Human-Centered Change Quality

## ADDED Requirements

### Requirement: Human impact filter
Every change MUST pass the human impact filter before proceeding.

#### Scenario: Critical refactor
- **WHEN** a change is a critical refactor with risk of context loss
- **THEN** a human MUST review the change

#### Scenario: Low-impact policy change
- **WHEN** a change is a low-impact policy change
- **THEN** the system MAY propose approval to the human

### Requirement: Cognitive quality
A change MUST be comprehensible to a human reviewer.

#### Scenario: Comprehension check
- **WHEN** a change is submitted for review
- **THEN** it MUST be understandable without additional explanation

### Requirement: Human autonomy
The system MUST assist while the human validates the delivered value.

#### Scenario: Human validates value
- **WHEN** the system proposes a change outcome
- **THEN** the human MUST validate the value before it is accepted

### Requirement: Early feedback
Quality MUST be defined before execution begins.

#### Scenario: Quality defined up front
- **WHEN** execution of a change starts
- **THEN** its quality criteria MUST already be defined

### Requirement: Completion gate human-quality checklist
The Completion Gate MUST verify the Human-Centered Quality checklist before archiving a change.

#### Scenario: Archive blocked without checklist
- **WHEN** a change is about to be archived
- **THEN** the Completion Gate MUST verify the Human-Centered Quality checklist
