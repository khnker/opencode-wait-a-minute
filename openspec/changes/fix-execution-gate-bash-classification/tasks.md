# Tasks: Fix bash mutation classification in the execution gate

- [x] 1. Add `src/execution/shell-mutation.js` with a quote/heredoc-aware scanner
  and `classifyBashMutation(command)`.
- [x] 2. Replace `BASH_MUTATION_RE` in `src/execution/execution-gate.js` with a
  call to `classifyBashMutation`.
- [x] 3. Add regression tests for the real read-only psql command, quoted
  operators/commands, real redirects, `>/dev/null`, `2>&1`, heredocs, wrappers
  and nested `sh -c`.
- [x] 4. Run affected suites with `node --test --test-force-exit`.
- [x] 5. Run `openspec validate --changes --strict` and `npm run build`.
- [x] 6. Verify in a fresh `opencode web` instance (`verify:web`) or record why
  it cannot run.
