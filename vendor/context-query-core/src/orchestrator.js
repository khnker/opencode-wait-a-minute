/**
 * orchestrator.js — Iterative retrieval orchestrator supporting deterministic
 * and shadow modes with budget handling, iteration limits,
 * duplicate query elimination, and terminal state management.
 */

import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { EvidenceEvaluator } from './evidence-evaluator.js';
import { QueryPlanner } from './query-planner.js';
import { SearchProvider } from './search-provider.js';

export class Orchestrator extends EventEmitter {
  constructor({ repoRoot, cacheDir, indexDir, budget, evaluator, planner }) {
    super();

    this.repoRoot = repoRoot;
    this.cacheDir = cacheDir;
    this.indexDir = indexDir;
    this.budget = budget;
    this.evaluator = evaluator;
    this.planner = planner;
    this.searchProvider = new SearchProvider({ repoRoot, cacheDir, indexDir });

    this.modes = {
      DETERMINISTIC: 'deterministic',
      SHADOW: 'shadow'
    };

    this.state = {
      iteration: 0,
      mode: this.modes.DETERMINISTIC,
      queries: [],
      results: [],
      terminal: false,
      budgetSpent: 0,
      timestamps: [],
      duplicates: []
    };

    this.terminals = new Map(); // evidence_id -> terminal state
    this.iterationHistory = [];

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Event handlers for various orchestration events
    this.on('iteration-complete', (data) => {
      this.handleIterationComplete(data);
    });
    
    this.on('duplicate-detected', (data) => {
      this.handleDuplicateDetected(data);
    });
    
    this.on('budget-exceeded', (data) => {
      this.handleBudgetExceeded(data);
    });
    
    this.on('max-iterations-reached', (data) => {
      this.handleMaxIterationsReached(data);
    });
    
    this.on('terminal-reached', (data) => {
      this.handleTerminalReached(data);
    });
  }

  async runIterativeRetrieval(query, options = {}) {
    const {
      mode = this.modes.DETERMINISTIC,
      budget = this.budget,
      maxIterations = 3,
      threshold = 0.7,
      eliminateDuplicates = true,
      enableShadowMode = false
    } = options;
    
    // Reset state for new retrieval
    this.resetState(mode);
    
    const startTime = Date.now();
    const retrievalId = this.generateRetrievalId();
    
    try {
      // Initialize planner and evaluator
      const plan = await this.planner.plan(query, {
        mode,
        budget,
        maxIterations,
        threshold
      });
      
      // Validate plan before execution
      const validation = await this.planner.validatePlan(plan);
      if (!validation.valid) {
        throw new Error(`Invalid plan: ${validation.error}`);
      }

      const criteria = Array.isArray(options.criteria) && options.criteria.length
        ? options.criteria
        : this.deriveCriteria(query, plan);

      const results = [];
      let hasMoreResults = true;
      let iteration = 0;
      let finalStatus = 'completed';

      // Track queries already executed in this retrieval to avoid duplicates
      const executedQueries = new Set();

      // Track per-iteration refined query candidates (consumed in order)
      const refinementQueue = [query];

      this.emit('retrieval-started', {
        query,
        retrievalId,
        plan,
        options: { mode, budget, maxIterations, threshold }
      });

      while (hasMoreResults && iteration < maxIterations && !this.state.terminal) {
        iteration++;
        this.state.iteration = iteration;

        const iterationStart = Date.now();

        // Pick the next refined query, skipping any that have already been executed
        let currentQuery = null;
        while (refinementQueue.length > 0) {
          const candidate = refinementQueue.shift();
          if (!executedQueries.has(candidate)) {
            currentQuery = candidate;
            executedQueries.add(candidate);
            this.state.queries.push(candidate);
            break;
          } else {
            // Already executed — record as duplicate query and continue
            this.state.duplicates.push({
              key: candidate,
              reason: 'query-already-executed',
              timestamp: Date.now()
            });
          }
        }

        if (!currentQuery) {
          // No fresh queries remain — stop iterating
          hasMoreResults = false;
          finalStatus = 'completed';
          break;
        }

        const iterationData = {
          query: currentQuery,
          originalQuery: query,
          iteration,
          startTime: iterationStart,
          mode,
          budget,
          maxIterations,
          threshold,
          results: [],
          terminal: false,
          budgetSpent: 0,
          duplicates: []
        };

        // Execute current iteration with the REFINED query
        const iterationResult = await this.executeIteration(currentQuery, iterationData, plan);

        // Process results
        if (iterationResult && iterationResult.length > 0) {
          iterationData.results = iterationResult;

          // Eliminate duplicates if enabled
          if (eliminateDuplicates) {
            iterationData.results = this.eliminateDuplicates(iterationData.results);
          }

          // Evaluate evidence
          iterationData.evaluatedResults = this.evaluateResults(iterationData.results);

          // Shadow mode: log results in iterationHistory but DO NOT commit
          if (mode !== this.modes.SHADOW) {
            results.push(...iterationData.results);
          }

          // Derive additional refinement terms from uncovered criteria
          // (kept simple: append a "deep" variant of current query so subsequent
          // iterations get a distinct query).
          const refinedVariant = `${currentQuery} deep`;
          if (!executedQueries.has(refinedVariant) && !refinementQueue.includes(refinedVariant)) {
            refinementQueue.push(refinedVariant);
          }

          // Stop early when coverage threshold is reached
          const coverageScore = iterationData.evaluatedResults?.coverageScore || 0;
          if (coverageScore >= threshold) {
            hasMoreResults = false;
          }
        }

        iterationData.endTime = Date.now();
        iterationData.duration = iterationData.endTime - iterationData.startTime;

        // Check budget constraints
        if (budget && this.state.budgetSpent >= budget) {
          hasMoreResults = false;
          finalStatus = 'terminated';
          this.emit('budget-exceeded', iterationData);
        }

        // Check max iterations
        if (iteration >= maxIterations) {
          hasMoreResults = false;
          if (finalStatus === 'completed') finalStatus = 'max_iterations';
          this.emit('max-iterations-reached', iterationData);
        }

        // Store iteration data
        this.iterationHistory.push(iterationData);

        // Emit completion event
        this.emit('iteration-complete', iterationData);

        // Check terminal states
        if (iterationData.terminal) {
          hasMoreResults = false;
          if (finalStatus === 'completed') finalStatus = 'terminated';
          this.emit('terminal-reached', iterationData);
        }
      }

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Shadow mode: never deliver committed results
      const deliveredResults = mode === this.modes.SHADOW ? [] : results;

      // Finalize results
      const finalResults = {
        retrievalId,
        query,
        originalQuery: query,
        iterations: iteration,
        iterationHistory: this.iterationHistory,
        results: deliveredResults,
        mode,
        budget,
        maxIterations,
        threshold,
        totalDuration,
        startTime,
        endTime,
        evaluation: this.evaluateFinalResults(deliveredResults, criteria),
        terminals: Array.from(this.terminals.values()),
        duplicatesEliminated: this.state.duplicates.length,
        budgetSpent: this.state.budgetSpent,
        status: this.state.terminal ? 'terminated' : finalStatus
      };
      
      // Save results for debugging/auditing
      await this.saveResults(finalResults);
      
      this.emit('retrieval-complete', finalResults);
      
      return finalResults;
      
    } catch (error) {
      const errorResult = {
        retrievalId,
        query,
        error: error.message,
        mode,
        budget,
        maxIterations,
        threshold,
        startTime,
        endTime: Date.now(),
        status: 'error',
        iterations: this.iterationHistory
      };
      
      this.emit('retrieval-error', errorResult);
      throw error;
    }
  }

  async executeIteration(query, iterationData, plan) {
    // Execute a single iteration of retrieval
    const { mode } = iterationData;

    switch (mode) {
      case this.modes.DETERMINISTIC:
        return this.executeDeterministicIteration(query, iterationData, plan);
      case this.modes.SHADOW:
        return this.executeShadowIteration(query, iterationData, plan);
      default:
        throw new Error(`Unknown mode: ${mode}`);
    }
  }

  async executeDeterministicIteration(query, iterationData, plan) {
    // Deterministic iteration logic
    const { budget, threshold } = iterationData;

    // Real retrieval via SearchProvider
    const limit = Math.max(10, Math.floor((budget || 1000) / 50));
    let retrieved = [];
    try {
      retrieved = await this.searchProvider.search(query, { limit });
    } catch (e) {
      retrieved = [];
    }

    // Filter by threshold
    let filteredEvidence = retrieved.filter(evidence => {
      const confidence = evidence.confidence || 0;
      return confidence >= threshold;
    });

    // Apply budget constraints
    if (budget) {
      const estimatedCost = filteredEvidence.reduce((sum, evidence) => {
        return sum + (evidence.cost?.tokens || 0);
      }, 0);

      if (estimatedCost > budget) {
        // Reduce evidence to fit budget
        const sortedByScore = filteredEvidence.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
        let totalCost = 0;
        const budgetEvidence = [];

        for (const evidence of sortedByScore) {
          const evidenceCost = evidence.cost?.tokens || 0;
          if (totalCost + evidenceCost <= budget) {
            budgetEvidence.push(evidence);
            totalCost += evidenceCost;
          }
        }

        filteredEvidence = budgetEvidence;
      }
    }

    iterationData.budgetSpent += filteredEvidence.reduce((sum, evidence) => {
      return sum + (evidence.cost?.tokens || 0);
    }, 0);

    return filteredEvidence;
  }

async executeShadowIteration(query, iterationData, plan) {
    // Shadow iteration logic - collect without committing
    const { budget, threshold } = iterationData;

    // Real retrieval via SearchProvider, tagged as shadow
    const limit = Math.max(10, Math.floor((budget || 1000) / 50));
    let retrieved = [];
    try {
      retrieved = await this.searchProvider.search(query, { limit });
    } catch (e) {
      retrieved = [];
    }

    const shadowEvidence = retrieved.map((item, index) => ({
      ...item,
      shadow: true,
      shadowId: `shadow-${index}-${Date.now()}`
    }));

    // Apply threshold filtering
    const filteredShadow = shadowEvidence.filter(evidence => {
      const confidence = evidence.confidence || 0;
      return confidence >= threshold;
    });

    iterationData.budgetSpent += filteredShadow.reduce((sum, evidence) => {
      return sum + (evidence.cost?.tokens || 0);
    }, 0);

    return filteredShadow;
  }

eliminateDuplicates(evidence) {
    // Remove duplicate evidence based on evidence_id and path
    const seen = new Map();
    const unique = [];
    
    for (const item of evidence) {
      const key = `${item.evidence_id}-${item.path}`;
      if (!seen.has(key)) {
        seen.set(key, item);
        unique.push(item);
      } else {
        this.state.duplicates.push({
          original: seen.get(key),
          duplicate: item,
          key,
          timestamp: Date.now()
        });
        this.emit('duplicate-detected', {
          original: seen.get(key),
          duplicate: item,
          key,
          timestamp: Date.now()
        });
      }
    }
    
    return unique;
  }

  evaluateResults(results) {
    if (!results || results.length === 0) {
      return null;
    }
    
    // Use evaluator to evaluate results
    const evaluation = {
      totalEvidence: results.length,
      uniqueEvidence: results.length,
      duplicateCount: this.state.duplicates.length,
      averageConfidence: 0,
      averageScore: 0,
      coverageScore: 0,
      evaluationTimestamp: Date.now()
    };
    
    // Compute averages
    const totalConfidence = results.reduce((sum, item) => {
      return sum + (item.confidence || 0);
    }, 0);
    
    const totalScore = results.reduce((sum, item) => {
      return sum + (item.score || 0);
    }, 0);
    
    evaluation.averageConfidence = totalConfidence / results.length;
    evaluation.averageScore = totalScore / results.length;
    
    // Evaluate using EvidenceEvaluator if we have criteria
    // For now, use simulated evaluation
    evaluation.coverageScore = evaluation.averageScore;
    
    return evaluation;
  }

  deriveCriteria(query, plan) {
    const stop = new Set([
      'find', 'of', 'and', 'follow', 'include', 'limit', 'budget',
      'implementation', 'definitions', 'references', 'usages',
      'filename', 'pattern', 'symbol', 'file', 'function', 'class',
      'constant', 'concept', 'tests', 'config', 'docs', 'generated'
    ]);
    const tokens = String(query || '')
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter(t => t && !stop.has(t) && !/^\d+$/.test(t));
    const unique = [...new Set(tokens)];
    return unique.length ? unique : [String(query || '').toLowerCase()].filter(Boolean);
  }

  evaluateFinalResults(results, criteria = []) {
    const list = Array.isArray(results) ? results : [];
    const crit = Array.isArray(criteria) ? criteria.filter(Boolean) : [];

    if (list.length === 0) {
      return {
        coverageScore: 0,
        averageConfidence: 0,
        averageScore: 0,
        totalEvidence: 0,
        recall: 0,
        precision: 0,
        mrr: 0,
        ndcg: 0,
        timestamp: Date.now()
      };
    }

    const ev = this.evaluator.evaluate(crit, list);

    return {
      ...ev,
      totalEvidence: list.length,
      averageConfidence: list.reduce((s, i) => s + (i.confidence || 0), 0) / list.length,
      averageScore: list.reduce((s, i) => s + (i.score || 0), 0) / list.length,
      recall: this.calculateRecall(list, crit, ev),
      precision: this.calculatePrecision(list, crit, ev),
      mrr: this.calculateMRR(list, crit, ev),
      ndcg: this.calculateNDCG(list, crit, ev),
      finalEvaluationTimestamp: Date.now()
    };
  }

  calculateRecall(results, criteria = [], ev = null) {
    if (!results.length || !criteria.length) return 0;
    const haystacks = results.map(r =>
      `${r.claim || ''} ${r.symbol || ''} ${r.path || ''}`.toLowerCase()
    );
    const matched = criteria.filter(c =>
      haystacks.some(h => h.includes(String(c).toLowerCase()))
    ).length;
    return this.clamp01(matched / criteria.length);
  }

  calculatePrecision(results, criteria = [], ev = null) {
    if (!results.length) return 0;
    const evaluation = ev || this.evaluator.evaluate(criteria, results);
    return this.clamp01(evaluation.covered / results.length);
  }

  calculateMRR(results, criteria = [], ev = null) {
    if (!results.length) return 0;
    const evaluation = ev || this.evaluator.evaluate(criteria, results);
    const idx = evaluation.details.findIndex(d => d.covered);
    return idx >= 0 ? this.clamp01(1 / (idx + 1)) : 0;
  }

  calculateNDCG(results, criteria = [], ev = null) {
    if (!results.length) return 0;
    const evaluation = ev || this.evaluator.evaluate(criteria, results);
    const rel = evaluation.details.map(d => (d.covered ? 1 : 0));
    const dcg = rel.reduce((sum, r, i) => sum + r / Math.log2(i + 2), 0);
    const R = rel.reduce((s, r) => s + r, 0);
    let idcg = 0;
    for (let i = 0; i < R; i++) idcg += 1 / Math.log2(i + 2);
    return idcg > 0 ? this.clamp01(dcg / idcg) : 0;
  }

  clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return Math.min(1, Math.max(0, v));
  }

  generateRetrievalId() {
    return `retrieval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  resetState(mode) {
    this.state = {
      iteration: 0,
      mode,
      queries: [],
      results: [],
      terminal: false,
      budgetSpent: 0,
      timestamps: [],
      duplicates: []
    };
    
    this.terminals.clear();
    this.iterationHistory = [];
  }

  handleIterationComplete(data) {
    // Handle iteration completion
    console.log(`Iteration ${data.iteration} completed`);
    
    // Check for terminal states
    if (data.terminal) {
      this.state.terminal = true;
    }
    
    // Emit additional metrics
    this.emit('metrics-update', {
      iteration: data.iteration,
      budgetSpent: data.budgetSpent,
      duplicateCount: data.duplicates.length,
      resultsCount: data.results.length
    });
  }

  handleDuplicateDetected(data) {
    // Handle duplicate detection
    console.log(`Duplicate detected: ${data.key}`);
  }

  handleBudgetExceeded(data) {
    // Handle budget exceeded
    console.log(`Budget exceeded in iteration ${data.iteration}`);
    this.state.terminal = true;
  }

  handleMaxIterationsReached(data) {
    // Handle max iterations reached
    console.log(`Max iterations reached: ${data.iteration}`);
    this.state.terminal = true;
  }

  handleTerminalReached(data) {
    // Handle terminal state reached
    console.log(`Terminal state reached in iteration ${data.iteration}`);
    this.state.terminal = true;
    
    // Mark evidence as terminal
    if (data.results) {
      data.results.forEach(item => {
        if (item.evidence_id) {
          this.terminals.set(item.evidence_id, {
            terminal: true,
            reason: data.reason || 'Reached terminal state',
            timestamp: Date.now()
          });
        }
      });
    }
  }

  async saveResults(results) {
    // Save results for debugging/auditing
    try {
      const resultsDir = this.cacheDir;
      if (!fs.existsSync(resultsDir)) {
        await fsp.mkdir(resultsDir, { recursive: true });
      }

      const resultsFile = `${resultsDir}/retrieval-${results.retrievalId}.json`;
      await fsp.writeFile(resultsFile, JSON.stringify(results, null, 2), 'utf8');
    } catch (e) {
      console.warn('Failed to save results:', e);
    }
  }

  async loadLastResults() {
    // Load last results from cache
    try {
      const cacheFiles = await fsp.readdir(this.cacheDir);
      const resultFiles = cacheFiles.filter(f => f.startsWith('retrieval-') && f.endsWith('.json'));

      if (resultFiles.length === 0) return null;

      const latestFile = resultFiles.sort().reverse()[0];
      const data = await fsp.readFile(join(this.cacheDir, latestFile), 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to load last results:', e);
      return null;
    }
  }

  clearCache() {
    try {
      if (!fs.existsSync(this.cacheDir)) return;
      fs.readdirSync(this.cacheDir).forEach(file => {
        if (file.startsWith('retrieval-') || file.startsWith('planner-') || file.startsWith('evaluator-')) {
          try {
            fs.unlinkSync(join(this.cacheDir, file));
          } catch (e) {
            // File might not exist
          }
        }
      });
    } catch (e) {
      console.warn('Failed to clear orchestrator cache:', e);
    }
  }
}