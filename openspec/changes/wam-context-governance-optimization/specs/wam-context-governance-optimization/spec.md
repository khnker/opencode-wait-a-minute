# WAM Context Governance Optimization — Specification

## ADDED Requirements
### Requirement: REQ-001: Pre-flight Context Cache
WAM SHALL return a cached governance summary (≤ 200 tokens) instead of re-reading full AGENTS.md files when pre-flight analyzing a request, if a cached summary exists and is fresh.
#### Scenario: First conversation turn
**Given** no cached summary exists
**When** pre-flight runs
**Then** it loads AGENTS.md, extracts actionable rules, caches summary, returns ≤ 200 tokens
#### Scenario: Subsequent conversation turn
**Given** cached summary is fresh (TTL < 5 min)
**When** pre-flight runs
**Then** it returns cached summary without file I/O

### Requirement: REQ-002: Historical Case Benchmarking
WAM SHALL surface the most relevant historical change (from git log / openspec archive) with its outcome tokens and test results when a change or task pattern matches prior history.
#### Scenario: Task matches prior change
**Given** history store indexed with last 30 commits
**When** user asks "optimize retrieval benchmarks"
**Then** it returns prior change `feat(wam): integrate discovery...` with 2938 tests pass, 0 fail

### Requirement: REQ-003: Trigram Index Warm-up
WAM SHALL ensure the tgrep index is current and available for sub-agents, avoiding cold-start search penalties, when WAM initializes.
#### Scenario: Index is stale
**Given** `tgrep status` reports index older than 1 hour
**When** warmup runs
**Then** it executes `tgrep index .` in background, completes before first search

### Requirement: REQ-004: Context Compression Protocol
WAM SHALL automatically compress closed sections of context when the conversation context exceeds 50% to prevent overflow and maintain performance.
#### Scenario: Context exceeds threshold
**Given** conversation context is at 55% of limit
**When** a new turn is added
**Then** the oldest closed sections are compressed to reduce token usage