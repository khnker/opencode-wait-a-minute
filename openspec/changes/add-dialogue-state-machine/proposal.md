# Proposal: LLM-assisted dialogue state machine

## Why

WAM currently classifies messages with regex and a small intent router. That
cannot distinguish a status check from a requirement, or an initial goal from a
later definition, and it has no durable model of the conversation stage. The
result is garbage contracts such as `req-1 — Reiniciado ve si esta ok`.

## What changes

- Add a typed dialogue observation schema returned by an LLM or deterministic
  observer.
- Add a pure reducer that derives stage/action from `(previous stage, observation)`.
- Add stages: IDLE, INTAKE, ELICITATION, CONTRACTING, APPROVED, EXECUTING,
  VERIFYING, COMPLETED, BLOCKED, CANCELLED.
- Add a bounded, state-keyed intent dictionary.
- Use the LLM only as an optional fallback for ambiguous observations.
- Integrate the observation into the message handler so META/CLARIFY messages
  do not arm the completion gate.

## Out of scope

- Replacing the existing completion gate.
- Letting the LLM approve contracts, grant permissions or declare DONE.
