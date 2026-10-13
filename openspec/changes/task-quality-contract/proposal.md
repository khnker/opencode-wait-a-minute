# Task Quality Contract

## Why

WAM currently has verification systems that can evaluate task completion, but lacks explicit structure for:
1. Defining task-type-specific evidence requirements (research, creation, modification, debugging, review)
2. Separating task classification from outcome determination
3. Enforcing evidence gates that prevent premature DONE marking based on insufficient evidence

The current system treats all tasks similarly in terms of evidence requirements, leading to:
- False DONE declarations when evidence is insufficient
- Unnecessary blocking when simpler verification would suffice
- Inconsistent application of verification rigor across task types

## What Changes

This change introduces a structured task quality contract system that:

### 1. Defines Task Quality Contract Structure
- Formalizes outcome contracts with explicit acceptance criteria
- Associates each criterion with required evidence types and strength levels
- Maintains separation between task profiling and verification requirements

### 2. Implements Task-Specific Evidence Gates
- Enhances outcome evaluator to check evidence sufficiency per criterion
- Integrates evidence gate checks into completion gate logic
- Prevents DONE transition when mandatory criteria lack sufficient evidence

### 3. Adds Task Classification with Confidence Metrics
- Extends request classifier to return task profiles with confidence levels
- Handles ambiguous/mixed task types without reducing verification rigor
- Provides justification for classification decisions

### 4. Includes Comprehensive Testing
- Unit tests for contract validation and evidence evaluation
- Integration tests verifying completion gate behavior
- Benchmark comparing before/after behavior on representative tasks

## Core Invariant

`DONE` MUST be blocked unless:
- The outcome contract specifies clear acceptance criteria
- Each mandatory criterion has sufficient, verifiable evidence
- Evidence strength meets criterion-specific requirements
- No blocking contradictions or unknowns exist
- The evaluation corresponds to current system state

## Implementation Plan

1. **define-task-quality-contract**
   - Extend outcome-evaluator.js with explicit contract structure
   - Enhance request-classifier.js with task profiling capabilities
   - Add validation for contract completeness and consistency

2. **enforce-task-specific-evidence-gates**
   - Modify completion gate logic to check evidence sufficiency
   - Update orchestration.js to integrate evidence gate evaluation
   - Ensure evidence evaluation uses current system state

3. **benchmark-task-quality-contract**
   - Create test suite with research/creation/modification/debugging/review tasks
   - Measure false DONE rates, false block rates, and verification costs
   - Validate that correct completion is still achievable without code changes when appropriate

## Acceptance Criteria

- Tasks with insufficient evidence are correctly blocked from DONE
- Tasks with sufficient evidence correctly reach DONE
- Task classification provides useful metadata without determining verification strictness
- Evidence gates apply appropriate rigor per criterion, not per task type
- Benchmark shows reduction in false DONE without unacceptable increase in false block or cost