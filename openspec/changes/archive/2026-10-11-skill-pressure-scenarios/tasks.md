# Tasks: Skill TDD / Pressure Scenarios
## 1. Format
- [x] 1.1 Define the pressure scenario format
- [x] 1.2 Define `skill/tests/{scenarios,baseline,expected}` layout
## 2. Harness
- [x] 2.1 Baseline runner (skill disabled)
- [x] 2.2 Skill-enabled runner
- [x] 2.3 Behavior comparator
## 3. Evidence
- [x] 3.1 Require evidence via the CH-05 model
- [x] 3.2 `UNVERIFIED` state for skills without a passing scenario
## 4. Benchmark + regression
- [x] 4.1 Register reproducible scenarios in the benchmark
- [x] 4.2 Skill modification triggers a regression run
## 5. Tests
- [x] 5.1 Scenario demonstrates without-skill failure
- [x] 5.2 Scenario demonstrates with-skill success
- [x] 5.3 Modified skill causes a regression failure when behavior breaks
