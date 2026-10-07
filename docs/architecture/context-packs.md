# Context Packs

## Overview

Context Packs is the subsystem responsible for context management, including classification, capture, routing, assembly, budgeting, compression, freshness, sufficiency, and levels N0-N3. It serves as the foundation for providing relevant context to agents during task execution.

## Mechanisms

### Context Classification
- **File**: `src/context/context-classification.js`
- **Purpose**: Classifies user prompts into task types and requirements
- **Mechanism**: Analyzes prompt structure and content to determine task category
- **Outputs**: Task classification with confidence scores
- **Integration**: Works with context selection (`src/context/context-selection.js`)

### Context Capture
- **File**: `src/context/context-capture.js`
- **Purpose**: Captures repository and system context for tasks
- **Mechanism**: Gathers relevant context based on task classification
- **Layers**:
  - **Core**: Essential files for the task
  - **Supporting**: Dependencies and configuration
  - **Evidence**: Test files and verification scripts
  - **Extended**: Broader repository for exploration

### Context Assembly
- **File**: `src/context/assembly.js`
- **Purpose**: Assembles context from multiple sources
- **Mechanism**: Combines classified and captured context into unified context packs
- **Integration**: Works with context builder (`src/context/context-builder.js`)

### Context Builder
- **File**: `src/context/context-builder.js`
- **Purpose**: Builds context packs for agent consumption
- **Mechanism**: Constructs context packs with relevant information
- **Features**:
  - Structured context organization
  - Priority-based context ordering
  - Compression-ready format

### Context Selection
- **File**: `src/context/context-selection.js`
- **Purpose**: Selects relevant context from available sources
- **Mechanism**: Uses scoring mechanism to rank context relevance
- **Scoring criteria**:
  - **Task relevance**: Files related to current task type
  - **Recency**: Recently accessed or modified files
  - **Dependency graph**: Files imported/required by relevant files
  - **Evidence needs**: Files needed for verification
  - **User focus**: Files mentioned in current prompt

### Context Budget Manager
- **File**: `src/context/context-budget-manager.js`
- **Purpose**: Manages context budget constraints
- **Mechanism**: Controls context consumption and limits
- **Features**:
  - Budget allocation
  - Context limit enforcement
  - Resource management

### Context Compression
- **File**: `src/context/context-compaction.js`
- **Purpose**: Compacts context for storage and transmission
- **Mechanism**: Compacts context while preserving essential information
- **Integration**: Works with context budget manager

### Context Freshness
- **File**: `src/context/context-freshness.js`
- **Purpose**: Manages context freshness and validity
- **Mechanism**: Ensures context is up-to-date and relevant
- **Features**:
  - Freshness validation
  - Context staleness detection
  - Context updates

### Context Dictionary
- **File**: `src/context/context-dictionary.js`
- **Purpose**: Provides context dictionary and terminology
- **Mechanism**: Manages context-related terminology and definitions
- **Integration**: Used by context classification and selection

### Context Drift Detection
- **File**: `src/context/context-drift-detection.js`
- **Purpose**: Detects context drift and changes
- **Mechanism**: Identifies significant context changes
- **Features**:
  - Drift detection
  - Context change alerts
  - Impact assessment

### Context Event Normalization
- **File**: `src/context/context-event-normalization.js`
- **Purpose**: Normalizes context events and data
- **Mechanism**: Standardizes context event formats
- **Integration**: Works with context capture and assembly

### Context Feedback Loop
- **File**: `src/context/context-feedback-loop.js`
- **Purpose**: Manages context feedback and improvement
- **Mechanism**: Collects and processes context feedback
- **Features**:
  - Feedback collection
  - Context improvement
  - Learning integration

### Context Graph
- **File**: `src/context/context-graph.js`
- **Purpose**: Manages context dependency graph
- **Mechanism**: Tracks and manages context relationships
- **Features**:
  - Dependency tracking
  - Context relationships
  - Graph-based context management

### Context Graph Builder
- **File**: `src/context/context-graph-builder.js`
- **Purpose**: Builds context dependency graphs
- **Mechanism**: Constructs context relationship graphs
- **Integration**: Used by context graph and selection

### Context History Relevance
- **File**: `src/context/context-history-relevance.js`
- **Purpose**: Manages context history and relevance
- **Mechanism**: Tracks context history and relevance
- **Features**:
  - History tracking
  - Relevance assessment
  - Context evolution

### Context Interception
- **File**: `src/context/context-interception.js`
- **Purpose**: Intercepts and modifies context
- **Mechanism**: Allows context interception and modification
- **Integration**: Used by context assembly and builder

### Context Event Ingress
- **File**: `src/context/context-event-ingress.js`
- **Purpose**: Manages context event ingress
- **Mechanism**: Handles context event ingestion
- **Features**:
  - Event capture
  - Event processing
  - Event routing

### Context Demotion
- **File**: `src/context/context-demotion.js`
- **Purpose**: Manages context demotion and downgrading
- **Mechanism**: Handles context demotion
- **Integration**: Used by context selection and budget manager

### Context Evaluation
- **File**: `src/context/context-evaluation.js`
- **Purpose**: Evaluates context quality and relevance
- **Mechanism**: Assesses context quality and relevance
- **Features**:
  - Quality assessment
  - Relevance evaluation
  - Context scoring

### Context Decision Audit
- **File**: `src/context/context-decision-audit.js`
- **Purpose**: Audits context decisions
- **Mechanism**: Audits context selection and assembly decisions
- **Features**:
  - Decision tracking
  - Audit logging
  - Decision analysis

### Context Capsule Staleness
- **File**: `src/context/context-capsule-staleness.js`
- **Purpose**: Manages context capsule staleness
- **Mechanism**: Tracks and manages context capsule staleness
- **Features**:
  - Staleness detection
  - Capsule management
  - Freshness tracking

### Active Context Boundary
- **File**: `src/context/active-context-boundary.js`
- **Purpose**: Manages active context boundary
- **Mechanism**: Defines and manages active context boundaries
- **Integration**: Used by context assembly and builder

### Context Assembly Contract
- **File**: `src/context/context-assembly-contract.js`
- **Purpose**: Manages context assembly contracts
- **Mechanism**: Defines and manages context assembly contracts
- **Features**:
  - Contract definition
  - Assembly rules
  - Integration standards

## Integration

### Dependency Relationships
- **Core pillar**: Part of context pillar in architecture taxonomy
- **Context selection**: Uses context selection (`src/context/context-selection.js`)
- **Context budget**: Works with context budget manager
- **Context compression**: Integrates with context compression
- **Context freshness**: Integrates with context freshness

### Data Flow
1. **Prompt → Classification**: User prompt classified by context-classification
2. **Classification → Selection**: Classification informs context selection
3. **Selection → Capture**: Selection determines context capture
4. **Capture → Assembly**: Captured context assembled
5. **Assembly → Builder**: Assembled context built
6. **Builder → Agent**: Context pack provided to agent
7. **Agent → Feedback**: Agent feedback processed by context feedback loop
8. **Feedback → Improvement**: Feedback improves future context packs

## Context Levels

### N0 Context
- **Purpose**: Minimal context for simple tasks
- **Characteristics**: Limited information, basic functionality

### N1 Context
- **Purpose**: Standard context for moderate tasks
- **Characteristics**: Comprehensive information, full functionality

### N2 Context
- **Purpose**: Extensive context for complex tasks
- **Characteristics**: Maximum relevant information, advanced functionality

### N3 Context
- **Purpose**: Complete context for expert tasks
- **Characteristics**: All available context, full capabilities

## Related Documentation
- [Architecture Overview](overview.md)
- [Task Lifecycle](task-lifecycle.md)
- [Runtime](runtime.md)
- [Persistence](persistence.md)