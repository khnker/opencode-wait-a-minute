# Proposal: Add a state-aware intent router

## Why

The current classifier only returns trivial/normal/architectural/research. It cannot distinguish conversation, continuation, correction or a new task, so WAM creates contracts for meta messages and re-synthesizes contracts on follow-ups.

## What changes

- Four lanes: CONVERSATION, CONTINUATION, CORRECTION, TASK_NEW.
- Signals: classifyRequest, meta-only detection, continuation regex, correction markers, task verbs + concrete object.
- Confidence: high when >=2 independent signals agree; otherwise default to CONVERSATION for short/meta messages and TASK_NEW for action verbs with a concrete object.
- Integration: message-handler uses the lane to choose no-contract (CONVERSATION), fast-path (CONTINUATION), contract update (CORRECTION) or contract synthesis (TASK_NEW).
- Research: intent classification + explicit dialogue state machines; rejected an LLM-only router (offline/latency) and kept a deterministic fallback.
