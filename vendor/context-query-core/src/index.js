// Re-export public API for backward compatibility and simple usage
export { createEngine, runCQP, runIntent } from './core.js';

// Core functionality exports
export { EvidenceEvaluator } from './evidence-evaluator.js';
export { QueryPlanner } from './query-planner.js';
export { Orchestrator } from './orchestrator.js';

// Utility exports
export { certaintyOf } from './evidence.js';

// Cross-layer coupling trace
export {
  traceCoupling, traceReferences, profileFor, registerProfile,
  COUPLING_EDGE_KINDS
} from './coupling-tracer.js';

export {
  traceCrossLayer, extractServerRoutes, extractPersistence, extractDispatches,
  normalizeRoutePath, matchUrlToRoute, classifyLayer, CROSS_LAYER_EDGE_KINDS
} from './cross-layer-tracer.js';

// Code relationship provider (change: add-repograph-code-relationship-provider)
export {
  RELATIONSHIP_TYPES, RESOLUTION_STATUS, CodeRelationshipProvider,
  relationshipConfig, safeStatus, relationshipToCandidate, enrichWithRelationships
} from './code-relationships.js';

// Repograph adapter (change: add-repograph-code-relationship-provider)
export {
  isExcludedPath, RepographProvider, createDefaultProvider
} from './repograph-provider.js';

// Structural ranking (change: add-repograph-structural-ranking)
export {
  structuralRankingConfig, applyStructuralRanking
} from './structural-ranking.js';
