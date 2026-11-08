# Close the task loop after an accepted agent run

## Why

Live Playwright validation of the first-message agent pass showed the four WAM
roles completing and the reviewer returning `ACCEPTED`, but the task requirement
stayed `pending`. The task loop then kept choosing `VERIFY` even after
`consecutiveNoProgress` exceeded `maxNoProgress`, so the main session spent its
turns inspecting WAM source instead of closing the task.

## What Changes

- When an agent run finishes as `COMPLETED` / `ACCEPTED`, WAM records the
  reviewer's evidence on every non-verified requirement and marks it `verified`.
  The reviewer is the pipeline's verification role; the Completion Gate still
  evaluates contract checks and the outcome contract before completion.
- The Completion Gate success shape (`allDone: true`) closes the loop, not only
  an empty `pending` array, so an accepted run cannot re-enter `VERIFY` forever.
- A `COMPLETE` decision persists the task as `DONE` with a completed next
  action, so the task state agrees with the closed loop instead of staying
  `IMPLEMENTING`.
- The no-progress stagnation guard takes precedence over the verification
  branch, so a task cannot loop in `VERIFY` forever when nothing changes.
- Regression tests cover both behaviors.
