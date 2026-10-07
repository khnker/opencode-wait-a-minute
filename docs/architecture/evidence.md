# Evidence

## Overview

Evidence is the subsystem responsible for correctness evidence, including claims, evidence, gaps, lineage, completion gates, and verification lifecycle/policy/model. It provides the foundation for verifying task correctness and ensuring all requirements are satisfied.

## Mechanisms

### Evidence Factory
- **File**: `src/evidence/evidence-factory.js`
- **Purpose**: Creates evidence objects
- **Mechanism**: Factory pattern for evidence creation
- **Types**:
  - **Verification evidence**: Evidence from verification steps
  - **Completion evidence**: Evidence demonstrating task completion
  - **Validation evidence**: Evidence validating requirements
  - **Audit evidence**: Evidence for compliance and correctness
- **Integration**: Used by evidence engine

### Evidence Engine
- **File**: `src/evidence/evidence-engine.js`
- **Purpose**: Manages evidence lifecycle
- **Mechanism**: Evidence creation, management, and lifecycle
- **Functions**:
  - `createEvidence()` - Creates evidence objects
  - `recordEvidence()` - Records evidence
  - `getEvidence()` - Retrieves evidence
  - `updateEvidence()` - Updates evidence
  - `deleteEvidence()` - Deletes evidence
- **Integration**: Works with evidence lineage and freshness

### Evidence Lineage
- **File**: `src/evidence/evidence-lineage.js`
- **Purpose**: Manages evidence lineage and relationships
- **Mechanism**: Tracks evidence creation, modification, and dependencies
- **Features**:
  - Evidence creation tracking
  - Dependency management
  - Lineage preservation
- **Integration**: Used by hypothesis manager for stale evidence detection

### Evidence Freshness
- **File**: `src/evidence/evidence-freshness.js`
- **Purpose**: Manages evidence freshness and validity
- **Mechanism**: Ensures evidence is current and relevant
- **Features**:
  - Freshness validation
  - Evidence staleness detection
  - Evidence updates

### Evidence Gap
- **File**: `src/evidence/evidence-gap.js`
- **Purpose**: Identifies evidence gaps
- **Mechanism**: Detects missing evidence for requirements
- **Integration**: Works with evidence engine for completeness

### Evidence Validation
- **File**: `src/evidence/freshness-validation.js`
- **Purpose**: Validates evidence freshness
- **Mechanism**: Validates evidence freshness and validity
- **Features**:
  - Validation rules
  - Freshness checking
  - Validity assessment

### Evidence Lineage Manager
- **File**: `src/evidence/lineage.js`
- **Purpose**: Manages evidence lineage
- **Mechanism**: Simple evidence lineage management
- **Integration**: Used by evidence engine

### Evidence Quality
- **File**: `src/evidence/evidence.js`
- **Purpose**: Provides evidence quality management
- **Mechanism**: Manages evidence quality and standards
- **Features**:
  - Quality assessment
  - Standard enforcement
  - Quality improvement

### Evidence Types
- **File**: `src/shared/decision-types.js`
- **Purpose**: Defines evidence types and structures
- **Mechanism**: Defines evidence-related data structures
- **Structures**:
  - **Decision types**: Evidence needed flags
  - **Evidence metadata**: Source, type, content
  - **Evidence status**: New, reviewed, accepted, rejected

### Evidence Classification
- **File**: `src/verification/false-completion-prevention.js`
- **Purpose**: Classifies evidence for false completion prevention
- **Mechanism**: Prevents false completion through evidence classification
- **Features**:
  - Classification rules
  - False completion prevention
  - Evidence quality assurance

## Integration

### Dependency Relationships
- **Verification subsystem**: `src/verification/` provides verification evidence
- **Cognition subsystem**: `src/cognition/` manages evidence hypotheses
- **Evidence factory**: Creates evidence objects for all subsystems
- **Evidence lineage**: Tracks evidence creation and dependencies
- **Evidence freshness**: Ensures evidence relevance and validity

### Data Flow
1. **Requirement → Evidence**: Requirements trigger evidence creation
2. **Evidence → Lineage**: Evidence tracked in lineage
3. **Lineage → Cognition**: Evidence lineage informs cognition
4. **Cognition → Evidence**: Cognition creates evidence hypotheses
5. **Evidence → Verification**: Evidence validated by verification
6. **Verification → Evidence**: Verification creates verification evidence
7. **Evidence → Completion**: Evidence contributes to completion

### Evidence Creation Process
1. **Requirement analysis**: Requirements analyzed for evidence needs
2. **Evidence creation**: Evidence objects created by evidence factory
3. **Evidence recording**: Evidence recorded by evidence engine
4. **Evidence tracking**: Evidence tracked in evidence lineage
5. **Evidence validation**: Evidence validated by evidence freshness
6. **Evidence gap detection**: Evidence gaps identified by evidence gap
7. **Evidence integration**: Evidence integrated into verification

## Evidence Types

### Verification Evidence
- **Purpose**: Evidence from verification steps
- **Characteristics**: Verification-specific evidence
- **Usage**: Task verification and validation

### Completion Evidence
- **Purpose**: Evidence demonstrating task completion
- **Characteristics**: Completion-specific evidence
- **Usage**: Task completion and closure

### Validation Evidence
- **Purpose**: Evidence validating requirements
- **Characteristics**: Validation-specific evidence
- **Usage**: Requirement validation and assurance

### Audit Evidence
- **Purpose**: Evidence for compliance and correctness
- **Characteristics**: Audit-specific evidence
- **Usage**: Audit and compliance validation

## Evidence Management

### Evidence Lifecycle
1. **Creation**: Evidence created by evidence factory
2. **Recording**: Evidence recorded by evidence engine
3. **Validation**: Evidence validated by evidence freshness
4. **Integration**: Evidence integrated into verification
5. **Usage**: Evidence used for completion and verification
6. **Archival**: Evidence archived for historical reference

### Evidence Quality Assurance
1. **Freshness validation**: Evidence freshness validated
2. **Quality assessment**: Evidence quality assessed
3. **Gap detection**: Evidence gaps identified
4. **Improvement**: Evidence quality improved

## Related Documentation
- [Architecture Overview](overview.md)
- [Task Lifecycle](task-lifecycle.md)
- [Cognition](cognition.md)
- [Completion](completion.md)
- [Runtime](runtime.md)