# Cognition

## Overview

Cognition is the subsystem that owns task identity and lifecycle, including state, persistence, recovery, requirements, runs, cognition store, observations, and hypotheses. It serves as the central repository for all task-related cognitive data and manages the learning/knowledge accumulation process across task executions.

## Mechanisms

### Cognitive Storage
- **Primary storage**: `src/cognition/cognition-store.js` - Single source of truth for all cognitive data
- **Location**: `.wam/tasks/<taskId>/cognition/` directory
- **Format**: JSONL (JSON Lines) files for append-only, immutable records
- **Key capabilities**:
  - `createExperiment()` - Creates hypothesis experiments
  - `recordObservation()` - Records observations tied to tasks
  - `getObservations()` - Retrieves task observations
  - `saveHypothesis()` - Persists hypothesis
  - `getHypotheses()` - Retrieves task hypotheses
  - `updateHypothesis()` - Updates hypothesis state

### Cognitive State Facade
- **File**: `src/cognition/cognitive-state.js`
- **Purpose**: Legacy API compatibility layer
- **Mechanism**: Delegates all operations to cognition-store.js
- **Functions**:
  - `loadCognitiveState()` - Deprecated, redirects to cognition-store
  - `saveCognitiveState()` - Deprecated no-op (cognition-store is source of truth)
  - `compactCognitiveState()` - Compacts cognitive state data

### Observation Engine
- **File**: `src/cognition/observation-engine.js`
- **Responsibility**: Generates observations from tool results
- **Mechanism**: Analyzes execution outcomes and creates structured observations
- **Inputs**: Tool results, task context, execution metadata
- **Outputs**: Observation objects with fact chains

### Observation Provenance
- **File**: `src/cognition/observation-provenance.js`
- **Purpose**: Unifies observation format across systems
- **Mechanism**: Normalizes observation data for consistency
- **Domains**: Task-runs, cognitive-state, cognition-store integration

### Hypothesis Manager
- **File**: `src/cognition/hypothesis-manager.js`
- **Responsibility**: Manages hypothesis lifecycle
- **Mechanism**: Creates, validates, and executes hypotheses
- **Features**:
  - Stale evidence detection for rejected hypotheses
  - Integration with evidence lineage (`src/evidence/evidence-lineage.js`)
  - Requirement tracking and validation

## Integration

### Dependency Relationships
- **Evidence engine dependency**: `src/evidence/evidence-engine.js` for evidence creation
- **State machine integration**: `src/policy/state-machine.js` for hypothesis transitions
- **Lifecycle coordination**: Works with task lifecycle (`src/task/` directory)

### Data Flow
1. **Execution → Cognition**: Tool results analyzed by observation-engine → cognition-store
2. **Cognition → Evidence**: Hypotheses trigger evidence creation via evidence-engine
3. **Evidence → Cognition**: Evidence results fed back to cognition-store for learning
4. **Persistence**: All cognition data stored in `.wam/tasks/<taskId>/cognition/`

## Related Documentation
- [Architecture Overview](overview.md)
- [Task Lifecycle](task-lifecycle.md)
- [Persistence](persistence.md)
- [Evidence](evidence.md)