# Design: LLM-assisted dialogue state machine

## Model

The LLM is a sensor, not an actuator. It returns observations:

```json
{
  "language": "es",
  "intent": "DEFINE",
  "speech_act": "assertion",
  "polarity": "affirmative",
  "confidence": 0.92,
  "answers_pending_question": false,
  "references_active_task": true,
  "scope_change": false,
  "ambiguity": "low",
  "contributions": [
    { "kind": "constraint", "text": "usar JWT", "confidence": 0.9 }
  ],
  "claims": [],
  "risk_flags": []
}
```

A pure reducer computes `nextStage = reduce(previousStage, observation, taskState)`.
It validates transitions and refuses to execute without an approved contract or
to complete without verified evidence.

## Stages

IDLE → INTAKE → ELICITATION → CONTRACTING → APPROVED → EXECUTING → VERIFYING →
COMPLETED, plus BLOCKED and CANCELLED.

## Fallback order

1. Deterministic heuristic observer.
2. State-keyed dictionary hit.
3. Optional LLM observer when confidence is low or intent is unknown.
4. Deterministic reducer, always.

The LLM adapter uses an OpenAI-compatible HTTP endpoint and is disabled unless
`WAM_DIALOGUE_LLM=1`, `WAM_DIALOGUE_LLM_ENDPOINT` and `WAM_DIALOGUE_LLM_MODEL`
are set. This bypasses the OpenCode session, so it cannot recurse into WAM.

## Safety

- APPROVE only when the message answers a pending question.
- CLAIM_DONE only completes when every requirement has evidence.
- Permissions and contract approval remain explicit deterministic actions.
- High ambiguity turns into CLARIFY, not a transition.
- Risk flags may force confirmation.

## Research links

- JSON Schema: https://json-schema.org/
- OpenAI structured outputs: https://platform.openai.com/docs/guides/structured-outputs
- Rasa forms / slot filling: https://rasa.com/docs/rasa/forms/
- XState state machines: https://stately.ai/docs/xstate

## Alternatives

- Pure regex/router (current): cheap and deterministic, but brittle and
  monolingual.
- Pure LLM router: flexible, but non-reproducible and unsafe for approvals.
- Structured command protocol: deterministic, but high user friction.
- Chosen: hybrid deterministic observer + optional LLM fallback + pure reducer.
