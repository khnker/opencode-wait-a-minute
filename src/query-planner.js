/**
 * query-planner.js — Deterministic query planner.
 *
 * Responsible for analyzing queries, detecting intent, planning retrieval strategies.
 */

import { runIntent } from './engine.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const VALID_INTENT_TYPES = [
  'definition', 'reference', 'callers', 'implementation', 'semantic',
  'structural', 'historical', 'services', 'similar', 'architecture',
  'decision', 'config', 'test'
];

export class QueryPlanner {
  constructor({ repoRoot, cacheDir, indexDir } = {}) {
    this.repoRoot = repoRoot;
    this.cacheDir = cacheDir;
    this.indexDir = indexDir;
    this.cacheFile = join(cacheDir, 'planner.json');
    this.strategies = {
      DETERMINISTIC: 'deterministic'
    };
  }

  async plan(query, options = {}) {
    const {
      mode = 'auto',
      budget = null,
      maxIterations = 3,
      threshold = 0.7
    } = options;

    let intent = await this.detectIntent(query);

    const queryType = this.inferQueryType(query, intent);
    const complexity = this.assessComplexity(query, intent, queryType);

    const plan = {
      query,
      intent,
      queryType,
      complexity,
      strategy: this.strategies.DETERMINISTIC,
      mode: 'deterministic',
      budget,
      maxIterations,
      threshold,
      steps: [],
      fallback: null,
      timestamp: Date.now()
    };

    plan.steps = await this.generateSteps(query, intent, queryType, plan);
    plan.fallback = this.generateFallback(plan);

    await this.savePlan(plan);
    return plan;
  }

  async detectIntent(query) {
    return this.deterministicClassify(query);
  }

  /**
   * Deterministic intent classification.
   */
  deterministicClassify(query) {
    const normalized = query.toLowerCase();
    const patterns = {
      definition: /(define|create|implement|add|new)\s+(component|service|function|class|method)/,
      reference: /(use|import|require|from|extend|based on)/,
      callers: /(caller|call|invoke|execute|run)/,
      implementation: /(implement|build|develop|write|create)/,
      semantic: /(meaning|concept|understand|relationship|association)/,
      structural: /(structure|organize|layout|design)/,
      historical: /(history|past|previous|before|changelog|version)/,
      services: /(service|api|endpoint|server|endpoint)/,
      similar: /(similar|like|similar to|pattern)/,
      architecture: /(architect|design|structure|system|component)/,
      decision:
        /(choose|select|decide|compare|evaluate|prefer|alternative|option)/,
      config: /(configure|setup|config|settings)/,
      test: /(test|spec|verify|validate)/,
    };

    for (const [intent, regex] of Object.entries(patterns)) {
      if (regex.test(normalized)) {
        return intent;
      }
    }

    return 'definition';
  }

  inferQueryType(query, intent) {
    const queryType = query.toLowerCase();

    if (queryType.includes('constructor') || queryType.includes('init')) {
      return 'definition';
    }

    if (queryType.includes('component') && queryType.includes('service')) {
      return 'reference';
    }

    if (queryType.includes('class') && queryType.includes('extends')) {
      return 'implementation';
    }

    if (queryType.includes('function') && queryType.includes('=>')) {
      return 'implementation';
    }

    if (intent === 'reference' && queryType.includes('import')) {
      return 'reference';
    }

    return intent;
  }

  assessComplexity(query, intent, queryType) {
    let complexity = 0;

    if (intent === 'definition' || intent === 'implementation') {
      complexity += 0.3;
    }

    if (intent === 'semantic' || intent === 'structural') {
      complexity += 0.4;
    }

    if (intent === 'decision' || intent === 'config') {
      complexity += 0.5;
    }

    if (query.toLowerCase().includes('chain') || query.toLowerCase().includes('complex')) {
      complexity += 0.5;
    }

    if (queryType === 'reference') {
      complexity += 0.2;
    }

    return Math.min(complexity, 1.0);
  }

  async generateSteps(query, intent, queryType, plan) {
    const steps = [
      {
        condition: ({ query, intent, queryType }) => queryType === 'definition',
        action: () => this.generateDefinitionStep(query, intent, queryType),
        method: 'generateDefinitionStep',
        priority: 1
      },
      {
        condition: ({ query, intent, queryType }) => queryType === 'reference',
        action: () => this.generateReferenceStep(query, intent, queryType),
        method: 'generateReferenceStep',
        priority: 1
      },
      {
        condition: ({ query, intent, queryType }) => queryType === 'implementation',
        action: () => this.generateImplementationStep(query, intent, queryType),
        method: 'generateImplementationStep',
        priority: 2
      },
      {
        condition: ({ intent, queryType }) => intent === 'semantic' || queryType === 'semantic',
        action: () => this.generateSemanticStep(query, intent, queryType),
        method: 'generateSemanticStep',
        priority: 2
      },
      {
        condition: ({ intent, queryType }) => intent === 'structural' || queryType === 'structural',
        action: () => this.generateStructuralStep(query, intent, queryType),
        method: 'generateStructuralStep',
        priority: 2
      },
      {
        condition: ({ query }) => query.toLowerCase().includes('similar') || query.toLowerCase().includes('like'),
        action: () => this.generateSimilarStep(query, intent, queryType),
        method: 'generateSimilarStep',
        priority: 1
      },
      {
        condition: ({ intent, queryType }) => intent === 'services' || queryType === 'services',
        action: () => this.generateServicesStep(query, intent, queryType),
        method: 'generateServicesStep',
        priority: 1
      },
      {
        condition: ({ intent }) => intent === 'historical',
        action: () => this.generateHistoricalStep(query, intent, queryType),
        method: 'generateHistoricalStep',
        priority: 1
      },
      {
        condition: ({ intent, queryType }) => intent === 'decision' || queryType === 'decision',
        action: () => this.generateDecisionStep(query, intent, queryType),
        method: 'generateDecisionStep',
        priority: 1
      },
      {
        condition: ({ intent, queryType }) => intent === 'config' || queryType === 'config',
        action: () => this.generateConfigStep(query, intent, queryType),
        method: 'generateConfigStep',
        priority: 1
      },
      {
        condition: ({ intent, queryType }) => intent === 'test' || queryType === 'test',
        action: () => this.generateTestStep(query, intent, queryType),
        method: 'generateTestStep',
        priority: 1
      },
      {
        condition: ({ query, intent, queryType }) => !queryType && intent !== 'semantic',
        action: () => this.inferQueryType(query, intent),
        method: 'inferQueryType',
        priority: 1
      }
    ];

    const planSteps = [];
    for (const step of steps) {
      const match = step.condition({ query, intent, queryType });
      if (match) {
        const result = step.action();
        if (result) {
          planSteps.push(result);
        }
      }
    }

    return planSteps;
  }

  generateFallback(plan) {
    return {
      approach: 'simple',
      description: 'Simple retrieval strategy',
      conditions: {
        onError: ['LLM-assisted classification failed']
      },
      fallback: {
        strategy: this.strategies.DETERMINISTIC,
        description: 'Deterministic fallback strategy'
      }
    };
  }

  async savePlan(plan) {
    if (!existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    const data = JSON.stringify(plan, null, 2);
    await fsp.writeFile(this.cacheFile, data);
  }

  // Helper step generation methods (basic implementations)

  generateDefinitionStep(query, intent, queryType) {
    return {
      type: 'retrieval',
      action: 'retrieve-by-keyword',
      terms: this.extractTerms(query),
      strategy: this.strategies.DETERMINISTIC,
      intent: intent,
      queryType: queryType,
      priority: 1
    };
  }

  generateReferenceStep(query, intent, queryType) {
    return {
      type: 'retrieval',
      action: 'retrieve-by-reference',
      terms: this.extractTerms(query),
      strategy: this.strategies.DETERMINISTIC,
      intent: intent,
      queryType: queryType,
      priority: 1
    };
  }

  generateImplementationStep(query, intent, queryType) {
    return {
      type: 'retrieval',
      action: 'retrieve-implementation',
      terms: this.extractTerms(query),
      strategy: this.strategies.DETERMINISTIC,
      intent: intent,
      queryType: queryType,
      priority: 2
    };
  }

  generateSemanticStep(query, intent, queryType) {
    return {
      type: 'retrieval',
      action: 'retrieve-semantic',
      terms: this.extractTerms(query),
      strategy: this.strategies.DETERMINISTIC,
      intent: intent,
      queryType: queryType,
      priority: 2
    };
  }

  generateStructuralStep(query, intent, queryType) {
    return {
      type: 'retrieval',
      action: 'retrieve-structural',
      terms: this.extractTerms(query),
      strategy: this.strategies.DETERMINISTIC,
      intent: intent,
      queryType: queryType,
      priority: 2
    };
  }

  generateSimilarStep(query, intent, queryType) {
    return {
      type: 'retrieval',
      action: 'retrieve-similar',
      terms: this.extractTerms(query),
      strategy: this.strategies.DETERMINISTIC,
      intent: intent,
      queryType: queryType,
      priority: 1
    };
  }

  generateServicesStep(query, intent, queryType) {
    return {
      type: 'retrieval',
      action: 'retrieve-services',
      terms: this.extractTerms(query),
      strategy: this.strategies.DETERMINISTIC,
      intent: intent,
      queryType: queryType,
      priority: 1
    };
  }

  generateHistoricalStep(query, intent, queryType) {
    return {
      type: 'retrieval',
      action: 'retrieve-historical',
      terms: this.extractTerms(query),
      strategy: this.strategies.DETERMINISTIC,
      intent: intent,
      queryType: queryType,
      priority: 1
    };
  }

  generateDecisionStep(query, intent, queryType) {
    return {
      type: 'retrieval',
      action: 'retrieve-decision',
      terms: this.extractTerms(query),
      strategy: this.strategies.DETERMINISTIC,
      intent: intent,
      queryType: queryType,
      priority: 1
    };
  }

  generateConfigStep(query, intent, queryType) {
    return {
      type: 'retrieval',
      action: 'retrieve-config',
      terms: this.extractTerms(query),
      strategy: this.strategies.DETERMINISTIC,
      intent: intent,
      queryType: queryType,
      priority: 1
    };
  }

  generateTestStep(query, intent, queryType) {
    return {
      type: 'retrieval',
      action: 'retrieve-test',
      terms: this.extractTerms(query),
      strategy: this.strategies.DETERMINISTIC,
      intent: intent,
      queryType: queryType,
      priority: 1
    };
  }

  extractTerms(query) {
    const normalized = query.toLowerCase();
    const matches = normalized.match(/\b[a-z]{3,}\b/g) || [];
    return matches
      .filter(word => !['the', 'and', 'for', 'with', 'that', 'this', 'from', 'have'].includes(word))
      .slice(0, 10);
  }
}
