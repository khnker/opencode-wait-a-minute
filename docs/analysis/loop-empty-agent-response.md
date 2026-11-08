# Why the task flow blocked instead of looping

Task: `task-analiza-este-flujo-deberia-haber-sido-un-loop-sess-Uj1TLPGa`

## Conclusion

The loop did start and did persist decisions, but it terminated on the first agent pass that
returned no text. An empty assistant response is converted into `AgentInvocationError("agent
response is empty")`, persisted as a `FAILED` agent run, and `decideAgentLoopAction` maps every
`FAILED` status directly to `BLOCK`. Because `FAILED` is handled before the stagnation check,
the loop never spends its `maxNoProgress` budget (3) and never retries: it stops at
`consecutiveNoProgress: 2` of 3.

This is different from the earlier DONE-task reuse issue: this task's `loop-state.json` proves
the controller reached iteration 2, so the loop itself was bound and running.

## Evidence chain

1. `.wam/.../execution/loop-events.jsonl` seq 6-7 are `CONTINUE` (iterations 1 and 2,
   `consecutiveNoProgress` 1 and 2); seq 8 is the first `BLOCK`. Seq 9-12 repeat `BLOCK`.
2. `.wam/.../execution/loop-state.json` shows `status: BLOCKED`, `iteration: 2`,
   `maxIterations: 10`, `maxNoProgress: 3`, `consecutiveNoProgress: 2`, `lastTurnId: null`.
3. `.wam/.../task.json:39` `lastAction` is
   `WAM task loop: BLOCK (agent-failed: agent response is empty)`.
4. `.wam/.../task.json:94` `failureReason` is `agent response is empty`; five run entries
   (`:99`, `:111`, `:123`, `:135`, `:147`) are `FAILED` with `stoppedAt: "agent"` and
   `resultCount: 0`.
5. `src/agents/invocation-adapter.js:196-200` throws that error whenever the extracted text is
   empty; the extraction is `responseText(data?.parts)` at `:349`, where `responseText`
   (`:220-226`) only accepts `part.type === "text"`.
6. `src/execution/task-agent-run.js:325-339` persists the failure as `status: "FAILED"` and
   records `failureReason`.
7. `src/execution/task-loop.js:22-29` maps `FAILED` to `decision: "BLOCK"` before the
   progress/stagnation branches, so no retry is attempted.

## Secondary risks

- **Response-shape assumption.** The adapter reads `response?.data ?? response` and then
  `data.parts`. The unit tests only exercise the `{ data: { parts: [...] } }` shape
  (`tests/unit/agent-invocation-adapter.test.mjs:60-72`). If the live SDK returns the
  assistant message in another shape (e.g. `info`/`parts` split or an array), a valid answer
  would be misread as empty. This is not proven here, but it is the first thing to check.
- **No turn attribution.** `lastTurnId` is `null` and the persisted failure keeps only the
  session id, so the provider/model and raw response cannot be recovered from the task state.
- **First empty response is terminal.** Empty output is treated as an unrecoverable agent
  failure rather than as a no-progress turn, which collapses the retry policy for this class
  of error.

## Recommendations

1. Capture the raw prompt response (shape, parts, provider/model, error) when extraction
   yields empty text, before throwing.
2. Verify the live `session.prompt` response shape against `responseText`; add a fixture for
   each supported shape.
3. Treat an empty response as a no-progress turn (increment `consecutiveNoProgress`) instead
   of an immediate terminal `BLOCK`, so `maxNoProgress` governs retries.
4. Add a regression test: empty first response -> loop continues/retries -> only blocks after
   the no-progress budget is exhausted.
5. Keep the DONE-task reuse fix and this empty-response fix separate; they are independent
   failure modes.
