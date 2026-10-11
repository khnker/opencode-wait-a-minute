# Design: Runtime Hardening for Release

Package is ESM. All runtime imports on production paths MUST use ESM-compatible imports.

The Strategy Continuity path must be exercised by test fixture that activates persisted strategy and reaches capability loading. Test must execute in clean Node process so accidental globals or test-runner behavior cannot hide `require`/module-format failures.

Package verification must import actual npm tarball produced by `npm pack`, not only source files from repository.
