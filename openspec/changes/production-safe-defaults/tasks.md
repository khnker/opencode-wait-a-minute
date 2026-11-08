# Tasks: production-safe-defaults

- [x] Default `logging` to `false` in `src/config/wam-config.js`.
- [x] Gate dashboard listening behind `WAM_DASHBOARD=true|1` in `index.js`.
- [x] Add tests for logging defaults and dashboard opt-in parsing.
- [x] Run affected tests, full suite, build, `openspec validate --changes --strict`, and fresh web verification.
- [x] Run the unified release gate and publish only after it passes.
