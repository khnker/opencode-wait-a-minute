# Change: Fix strategy tool coverage and orphan execution gates

## ADDED Requirements
### Requirement: Fallback candidate binds executable and argv
The fallback classifier MUST build its candidate from the derived executable and split command argv, so `command.execute` capabilities match by executable and argv prefix.

#### Scenario: command capability matches the approved executable
- GIVEN an active strategy whose allowedActions are `["npm test"]`
- WHEN the fallback classifier receives tool `bash` with command `npm test`
- THEN it MUST return `covered: true`

#### Scenario: command capability does not match a different command
- GIVEN an active strategy whose allowedActions are `["npm test"]`
- WHEN the fallback classifier receives tool `bash` with command `npm publish`
- THEN it MUST return `covered: false`

#### Scenario: trailing argv does not break a prefix match
- GIVEN an active strategy whose allowedActions are `["git status"]`
- WHEN the fallback classifier receives tool `bash` with command
  `git status --short`
- THEN it MUST return `covered: true`
