# Tasks: review-artifacts-visible

- [x] Render `reviewArtifacts` in `buildAgentUserPrompt`.
- [x] Add the reviewer failing-artifact rule to the system prompt.
- [x] Add `detectReviewArtifactFailure` and the first-review verdict gate.
- [x] Add unit tests for the prompt section, the rule, and the gate.
- [x] Run affected unit tests and the build.
- [ ] Validate in a fresh `opencode web` session with a hidden failing test.
  - Fresh run completed: first REVIEWER `REVISION_REQUIRED` citing `review/format2-hidden.log`, revision builder ran, second REVIEWER `ACCEPTED`, task `DONE`.
  - Fresh artifact run exposed the gap: first REVIEWER `ACCEPTED` despite `✖ suffix` / `fail 1` in the injected artifact (`/tmp/opencode/wam-review-artifacts-fresh-1793843473.json`). The deterministic gate was added in response.
  - Canonical fresh web E2E after the prompt change: 11/11 checks (`/tmp/wam-web-e2e-fresh-1793843386/report.md`).
  - Caveat: the first hidden test actually passed 3/3; the failing artifact was injected. The suffix-hidden-test harness timed out waiting for the first builder (no `agentRun`) on repeated runs, so organic failure and the fresh gate path are not yet proven end-to-end. Gate behavior is covered by unit tests.
