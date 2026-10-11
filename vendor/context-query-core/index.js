export { createEngine, runCQP, runIntent } from './src/core.js';
export { EvidenceEvaluator } from './src/evidence-evaluator.js';
export { QueryPlanner } from './src/query-planner.js';
export { Orchestrator } from './src/orchestrator.js';
export { traceCoupling, traceReferences, profileFor, registerProfile, COUPLING_EDGE_KINDS } from './src/coupling-tracer.js';
export { traceCrossLayer, extractServerRoutes, extractPersistence, extractDispatches, normalizeRoutePath, matchUrlToRoute, classifyLayer, CROSS_LAYER_EDGE_KINDS } from './src/cross-layer-tracer.js';
export { RELATIONSHIP_TYPES, RESOLUTION_STATUS, CodeRelationshipProvider, relationshipConfig, safeStatus, relationshipToCandidate, enrichWithRelationships } from './src/code-relationships.js';
export { isExcludedPath, RepographProvider, createDefaultProvider } from './src/repograph-provider.js';
export { structuralRankingConfig, applyStructuralRanking } from './src/structural-ranking.js';
