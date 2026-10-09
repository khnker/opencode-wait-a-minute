/**
 * Skill-routing accuracy corpus.
 *
 * Each case pairs a realistic prompt with:
 *  - expected: skills that MUST be selected (domain match / recall)
 *  - forbidden: skills that MUST NOT be selected (cross-domain leakage / precision)
 *
 * Base skills (loadStrategy: "base") are always selected and are ignored by
 * both lists. This corpus is deterministic and network-free.
 */

export const SKILL_ROUTING_CORPUS = [
  {
    id: "fe-angular",
    prompt: "Create an Angular component with signals and a service that calls the API",
    expected: ["angular-developer"],
    forbidden: ["nestjs-developer", "backend-integrity"],
  },
  {
    id: "fe-angular-scaffold",
    prompt: "Scaffold a new Angular application with routing and standalone components",
    expected: ["angular-new-app"],
    forbidden: ["nestjs-developer"],
  },
  {
    id: "be-nestjs",
    prompt: "Fix the NestJS controller and TypeORM migration for the invoices module",
    expected: ["nestjs-developer"],
    forbidden: ["angular-developer", "angular-new-app"],
  },
  {
    id: "db-queries",
    prompt: "Optimize slow database queries and add the missing indices",
    expected: ["backend-integrity"],
    forbidden: ["angular-developer", "angular-new-app"],
  },
  {
    id: "sec-audit",
    prompt: "Audit the security of this auth flow and report vulnerabilities",
    expected: ["github-awesome-copilot-mcp-security-audit"],
    forbidden: ["angular-new-app"],
  },
  {
    id: "refactor",
    prompt: "Refactor this module to reduce duplication",
    expected: ["senior-refactor-reviewer"],
    forbidden: ["angular-new-app"],
  },
  {
    id: "arch",
    prompt: "Design the architecture for a new microservice and evaluate tradeoffs",
    expected: ["architectural-governance"],
    forbidden: ["angular-new-app"],
  },
];

/**
 * Base skills that bypass scoring and are always injected. Excluded from
 * precision/recall accounting so the metric measures routing, not the base set.
 */
export const BASE_SKILL_IDS = new Set([
  "codebase-design",
  "writing-for-agents",
  "dietrichgebert-ponytail-ponytail",
]);
