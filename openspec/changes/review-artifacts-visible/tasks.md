# Tasks: review-artifacts-visible

- [x] Render `reviewArtifacts` in `buildAgentUserPrompt`.
- [x] Add the reviewer failing-artifact rule to the system prompt.
- [x] Add `detectReviewArtifactFailure` and the first-review verdict gate.
- [x] Add unit tests for the prompt section, the rule, and the gate.
- [x] Run affected unit tests and the build.
- [x] Validate in a fresh `opencode web` session with a hidden failing test.
  - Fresh run completed: first REVIEWER `REVISION_REQUIRED` citing `review/format2-hidden.log`, revision builder ran, second REVIEWER `ACCEPTED`, task `DONE`.
  - Fresh artifact run exposed the gap: first REVIEWER `ACCEPTED` despite `✖ suffix` / `fail 1` in the injected artifact (`/tmp/opencode/wam-review-artifacts-fresh-1793843473.json`). The deterministic gate was added in response.
  - Canonical fresh web E2E after the prompt change: 11/11 checks (`/tmp/wam-web-e2e-fresh-1793843386/report.md`).
  - Gate proof in a fresh `opencode web` process: `/tmp/wam-review-restart-DZF8Jx` (session `ses_...u701o1m1`). The task snapshot was seeded with a deliberately failing hidden test (`✖ hidden sentinel`, `fail 1`) and reloaded by a new server process; first REVIEWER returned `REVISION_REQUIRED` citing `review/format2-hidden.log`, followed by three builder/reviewer cycles. Evidence: `/tmp/opencode/wam-review-artifacts-restart-proof.json`.
  - Caveat: the hidden artifact is seeded into the persisted task snapshot, not produced organically by the fixture; organic failure remains unproven. The gate path itself is proven in a fresh server process.
