# Tasks: hermetic-release-tests

- [x] Point the CQE nonfunctional test at the vendored engine.
- [x] Remove the unused sibling dependency from `package.json`.
- [x] Skip skill-routing and skill-audit tests only when required skills are absent.
- [x] Verify the affected tests with an empty `HOME`.
- [ ] Run the release gate and republish.
