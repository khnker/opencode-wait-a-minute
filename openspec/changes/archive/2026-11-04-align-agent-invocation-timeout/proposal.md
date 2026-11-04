# Align the adapter invocation timeout

## Problem

A builder pass that takes longer than two minutes is aborted by the invocation
adapter even though the orchestrator allows five minutes. The abort is wrapped as
`PROMPT_FAILED` ("failed to prompt agent session"), so the persisted failure reason
hides the timeout and the task is parked as if the prompt were broken.

Live evidence (task `task-analiza-...-Uj1TLPGa`): the BUILDER child session was
created at `1793828283967` and the failure was persisted at `1793828403969`
(120,002 ms later), exactly the adapter default. The child kept working and produced
its result at `1793828409094`, after the adapter had already aborted it.

## Change

- Source the adapter default timeout from `AGENT_RESOURCE_LIMITS.maxInvocationMs`
  (currently `300000`) so the adapter and orchestrator share one deadline.
- Classify an aborted prompt (`AbortError` / `signal.aborted`) as `PROMPT_TIMEOUT`
  instead of `PROMPT_FAILED`.
- Include the error code and cause chain in the persisted `failureReason` so future
  adapter failures are diagnosable without enabling logs.

## Alternatives

- **Remove the adapter timeout entirely**: rejected because the adapter can be used
  without the orchestrator and would then hang forever.
- **Pass `maxInvocationMs` through the agent request**: rejected for now because the
  request contract is strict and the orchestrator default already equals the shared
  constant.
- **Only raise the adapter constant to 300000**: rejected alone because a timeout
  would still be reported as a prompt failure.

## Risks

- A pass can now run up to five minutes before aborting, matching the orchestrator's
  documented limit.
- Custom `resourceLimits.maxInvocationMs` overrides still require a matching adapter
  `toolTimeoutMs` override; documented in the change.
