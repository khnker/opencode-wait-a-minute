# WAM Context Governance Optimization — Specification

## ADDED Requirements

### Requirement: REQ-001: Pre-flight Context Cache
**Given** an agent starts a conversation  
**When** WAM pre-flight analyzes the request  
**Then** it SHALL return a cached governance summary (≤ 200 tokens) instead of re-reading full AGENTS.md files

#### Scenario: First conversation turn
**Given** no cached summary exists  
**When** pre-flight runs  
**Then** it loads AGENTS.md, extracts actionable rules, caches summary, returns ≤ 200 tokens

#### Scenario: Subsequent conversation turn
**Given** cached summary is fresh (TTL < 5 min)  
**When** pre-flight runs  
**Then** it returns cached summary without file I/O

### Requirement: REQ-002: Historical Case Benchmarking
**Given** a change or task pattern matches prior history  
**When** WAM retrieves context  
**Then** it SHALL surface the most relevant historical change (from git log / openspec archive) with its outcome tokens and test results

#### Scenario: Task matches prior change
**Given** history store indexed with last 30 commits  
**When** user asks "optimize retrieval benchmarks"  
**Then** it returns prior change `feat(wam): integrate discovery...` with 2938 tests pass, 0 fail

### Requirement: REQ-003: Trigram Index Warm-up
**Given** the project has a `tgrep` index  
**When** WAM initializes  
**Then** it SHALL ensure the index is current and available for sub-agents, avoiding cold-start search penalties

#### Scenario: Index is stale
**Given** `tgrep status` reports index older than 1 hour  
**When** warmup runs  
**Then** it executes `tgrep index .` in background, completes before first search

### Requirement: REQ-004: Context Compression Protocol
**Given** conversation context exceeds 50% capacity  
**When** WAM detects pressure  
**Then** it SHALL trigger compression of closed sections per the existing protocol, preserving only actionable signals

#### Scenario: Context at 60% capacity
**Given** runtime guard detects > 50% context used  
**When** compression triggers  
**Then** closed sections compressed, actionable signals preserved, capacity drops below 50%

## Acceptance Criteria
- Initial token overhead reduced by ≥ 40% vs baseline
- Historical case lookup returns relevant prior change in < 100ms
- Zero cold-start search penalty when `tgrep` index is valid
- Compression activates automatically at threshold