## Why

When a child agent session finishes with a provider error and no text parts, the
adapter reports `agent response is empty` and discards the underlying API error.
The loop then persists an unhelpful `failed to prompt agent session; ... agent
response is empty`, hiding the real cause (for example a 503 from the model
router) from the user and from diagnostics.

## What Changes

- Detect `info.error`/`error` in the session prompt response before parsing text.
- Raise `PROMPT_FAILED` with a message that includes the provider message and
  status code, and keep the original error as `cause`.
- Add a regression test for the response shape returned by the legacy
  `POST /session/{id}/message` endpoint.
