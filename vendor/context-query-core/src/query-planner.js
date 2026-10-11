/**
 * query-planner.js — Deterministic query planner.
 *
 * Responsible for analyzing queries, detecting intent, and planning retrieval strategies
 * using deterministic heuristics only.
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
      budget = null,
      maxIterations = 3,
      threshold = 0.7
    } = options;

    const intent = await this.detectIntent(query);
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
      decision: /(decision|choose|select|option|alternative)/,
      config: /(config|configuration|setting|option)/,
      test: /(test|unit|integration|spec|spec)/,
    };
    
    for (const [intent, regex] of Object.entries(patterns)) {
      if (regex.test(normalized)) {
        return {
          type: intent,
          confidence: 0.8,
          approach: this.intentToApproach(intent),
          complexity: this.intentToComplexity(intent)
        };
      }
    }
    
    return {
      type: 'definition',
      confidence: 0.5,
      approach: 'deterministic',
      complexity: 0.5
    };
  }

  inferQueryType(query, intent) {
    const intentToQueryType = {
      definition: 'definitions',
      reference: 'references',
      callers: 'callers',
      implementation: 'definitions',
      semantic: 'semantic',
      structural: 'structural',
      historical: 'history',
      services: 'definitions',
      similar: 'semantic',
      architecture: 'definitions',
      decision: 'definitions',
      config: 'definitions',
      test: 'test'
    };
    
    return intentToQueryType[intent.type] || 'definitions';
  }

  assessComplexity(query, intent, queryType) {
    let complexity = 0.5; // base
    
    // Increase complexity based on intent type
    if (intent.complexity) {
      complexity = intent.complexity;
    }
    
    // Increase for longer queries
    if (query.length > 100) {
      complexity = Math.min(complexity + 0.2, 1.0);
    }
    
    // Increase for multi-part queries
    if (query.includes(' AND ') || query.includes(' OR ')) {
      complexity = Math.min(complexity + 0.3, 1.0);
    }
    
    return complexity;
  }

  intentToApproach(intentType) {
    const approachMap = {
      definition: 'deterministic',
      reference: 'deterministic',
      callers: 'structural',
      implementation: 'deterministic',
      semantic: 'semantic',
      structural: 'structural',
      historical: 'git-history',
      services: 'federated',
      similar: 'semantic',
      architecture: 'deterministic',
      decision: 'deterministic',
      config: 'deterministic',
      test: 'test'
    };
    
    return approachMap[intentType] || 'deterministic';
  }

  intentToComplexity(intentType) {
    const complexityMap = {
      definition: 0.5,
      reference: 0.4,
      callers: 0.7,
      implementation: 0.6,
      semantic: 0.8,
      structural: 0.6,
      historical: 0.3,
      services: 0.7,
      similar: 0.8,
      architecture: 0.7,
      decision: 0.6,
      config: 0.3,
      test: 0.7
    };
    
    return complexityMap[intentType] || 0.5;
  }

  async generateSteps(query, intent, queryType, plan) {
    const steps = [];
    
    // Step 1: Initial query processing
    steps.push({
      id: 1,
      type: 'initial-query',
      description: 'Process initial query and extract key terms',
      strategy: plan.strategy,
      status: 'pending'
    });
    
    // Step 2: Intent verification (skipped — deterministic planner)
    steps.push({
      id: 2,
      type: 'intent-verification',
      description: 'Verify query intent (deterministic)',
      strategy: 'deterministic',
      status: 'skipped'
    });
    
    // Step 3: Retrieve candidates
    steps.push({
      id: 3,
      type: 'retrieve',
      description: `Retrieve candidates for ${queryType} using ${plan.strategy} strategy`,
      strategy: plan.strategy,
      status: 'pending'
    });
    
    // Step 4: Rerank candidates
    steps.push({
      id: 4,
      type: 'rerank',
      description: 'Apply reranking algorithm to filter candidates',
      strategy: plan.strategy,
      status: 'pending'
    });
    
    // Step 5: Validate output
    steps.push({
      id: 5,
      type: 'validate',
      description: 'Validate retrieved evidence against query requirements',
      strategy: plan.strategy,
      status: 'pending'
    });
    
    return steps;
  }

  generateFallback(plan) {
    return {
      strategy: this.strategies.DETERMINISTIC,
      reason: 'Deterministic approach reached budget/iteration limit',
      maxIterations: plan.maxIterations,
      timestamp: Date.now()
    };
  }

  async validatePlan(plan) {
    const requiredFields = ['query', 'intent', 'queryType', 'strategy', 'steps'];
    
    for (const field of requiredFields) {
      if (!plan[field]) {
        return {
          valid: false,
          error: `Missing required field: ${field}`,
          details: { field }
        };
      }
    }
    
    // Validate steps
    for (let i = 1; i <= 5; i++) {
      const step = plan.steps.find(s => s.id === i);
      if (!step) {
        return {
          valid: false,
          error: `Missing step ${i} in plan`,
          details: { stepId: i }
        };
      }
    }
    
    return {
      valid: true,
      error: null,
      details: null
    };
  }

  async savePlan(plan) {
    try {
      const dir = this.cacheDir;
      if (!existsSync(dir)) {
        const fs = await import('fs').then(m => m.promises);
        await fs.mkdir(dir, { recursive: true });
      }
      
      const fs = await import('fs').then(m => m.promises);
      await fs.writeFile(
        this.cacheFile,
        JSON.stringify(plan, null, 2),
        'utf8'
      );
    } catch (e) {
      console.warn('Failed to save planner cache:', e);
    }
  }

  async loadPlan() {
    if (existsSync(this.cacheFile)) {
      try {
        const data = JSON.parse(readFileSync(this.cacheFile, 'utf8'));
        return data;
      } catch (e) {
        console.warn('Failed to load planner cache:', e);
      }
    }
    return null;
  }

  clearCache() {
    try {
      const fs = require('fs').promises;
      fs.unlinkSync(this.cacheFile);
    } catch (e) {
      // File might not exist, ignore
    }
  }

  async generateSuggestions(query) {
    // Generate alternative query suggestions for the given query
    const suggestions = [];
    
    // Simple suggestion logic
    const normalized = query.toLowerCase();
    
    if (normalized.includes('function')) {
      suggestions.push('Search for function definitions with similar signatures');
      suggestions.push('Find callers of the target function');
      suggestions.push('Look for similar named functions');
    }
    
    if (normalized.includes('class')) {
      suggestions.push('Search for class definitions');
      suggestions.push('Find subclasses and implementations');
      suggestions.push('Look for usage examples in tests');
    }
    
    if (normalized.includes('middleware')) {
      suggestions.push('Find authentication patterns');
      suggestions.push('Search for error handling middleware');
      suggestions.push('Look for request/response transformations');
    }
    
    return suggestions;
  }

  async improveQuery(query, context = {}) {
    // Improve a query based on context and feedback
    const improvements = [];
    
    // Simple improvement logic
    const normalized = query.toLowerCase();
    
    if (normalized.includes('create')) {
      improvements.push('Consider adding specific parameters or interfaces');
    }
    
    if (normalized.includes('find')) {
      improvements.push('Add filter criteria to reduce false positives');
    }
    
    if (normalized.includes('all')) {
      improvements.push('Narrow scope to specific components or modules');
    }
    
    return {
      original: query,
      improvements,
      suggestedQuery: query + (improvements.length > 0 ? ' ' + improvements[0].toLowerCase() : '')
    };
  }
}