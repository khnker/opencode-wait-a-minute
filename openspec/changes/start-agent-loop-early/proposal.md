# Start the WAM agent loop on the first message

## Why

The task loop currently starts only on `session.idle`. Main sessions that keep
working never reach that event, so the WAM role pipeline never runs and the
session behaves as if WAM agents were disabled. The state can also report
`contract.status: APPROVED` while `phase` still says `PROPOSED`, adding
confusion about whether implementation is allowed.

## What Changes

- Classify each prompt as `IMPLEMENT`, `ANALYZE`, or `INLINE`.
- On the first message of a non-inline task, start the configured WAM agent pass
  immediately instead of waiting for `session.idle`.
- Add an execution gate that blocks mutating tools on the main session while
  the agent pass is running. Worker/subagent sessions remain exempt.
- Run `ANALYZE` tasks through a read-only `ANALYST → ARCHITECT → REVIEWER`
  pipeline with no `BUILDER`.
- Keep `session.idle` as a fallback for tasks that still need a pass.
- Normalize an already-approved contract from `PROPOSED` to `IMPLEMENTING`.
