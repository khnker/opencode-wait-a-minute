/**
 * evidence-evaluator.js — Structural and semantic evaluation of criteria coverage.
 *
 * Provides evaluation capabilities for evidence packets, computing coverage metrics,
 * confidence scores, and semantic similarity between evidence and query intent.
 */

import { certaintyOf } from './evidence.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export class EvidenceEvaluator {
  constructor({ repoRoot, cacheDir, indexDir } = {}) {
    this.repoRoot = repoRoot || process.cwd();
    this.cacheDir = cacheDir || join(this.repoRoot, '.cache');
    this.indexDir = indexDir || join(this.repoRoot, '.index');
    this.cacheFile = join(this.cacheDir, 'evaluator.json');
    this.indexFile = join(this.indexDir, 'stats.json');
  }

  evaluate(criteria, evidence) {
    const list = Array.isArray(evidence) ? evidence : [];
    const result = {
      coverageScore: 0.0,
      structuralScore: 0.0,
      semanticScore: 0.0,
      details: [],
      totalEvaluated: list.length,
      covered: 0
    };

    if (list.length === 0) {
      return result;
    }

    const criteriaSet = new Set((Array.isArray(criteria) ? criteria : []).map(c => c.toLowerCase()));

    for (const item of list) {
      const itemCriteria = Array.isArray(item.criteria) ? item.criteria.map(c => c.toLowerCase()) : [];
      const structuralMatches = this.calculateStructuralMatch(item, criteriaSet);
      const semanticMatches = this.calculateSemanticMatch(item, criteriaSet);
      
      const maxMatchScore = Math.max(structuralMatches, semanticMatches);
      const claimMatch = item.claim && [...criteriaSet].some(c => item.claim.toLowerCase().includes(c));
      const isCovered = maxMatchScore > 0 || Boolean(claimMatch);
      
      if (isCovered) {
        result.covered++;
        result.details.push({
          evidenceId: item.evidence_id,
          structuralMatch: structuralMatches,
          semanticMatch: semanticMatches,
          covered: true
        });
      } else {
        result.details.push({
          evidenceId: item.evidence_id,
          structuralMatch: structuralMatches,
          semanticMatch: semanticMatches,
          covered: false
        });
      }
    }

    result.coverageScore = result.covered / result.totalEvaluated;
    result.structuralScore = this.weightedScore(result.details, 'structuralMatch');
    result.semanticScore = this.weightedScore(result.details, 'semanticMatch');
    
    return result;
  }

  calculateStructuralMatch(evidence, criteriaSet) {
    // Simple structural matching logic
    let matches = 0;
    const total = 2; // normalized to 0-1
    
    if (evidence.symbol && evidence.symbol.toLowerCase()) {
      for (const criterion of criteriaSet) {
        if (criterion.includes(evidence.symbol.toLowerCase()) || 
            evidence.symbol.toLowerCase().includes(criterion)) {
          matches++;
        }
      }
    }
    
    if (evidence.subject?.file && evidence.subject.file.toLowerCase()) {
      for (const criterion of criteriaSet) {
        if (criterion.includes(evidence.subject.file.toLowerCase()) ||
            evidence.subject.file.toLowerCase().includes(criterion)) {
          matches++;
        }
      }
    }
    
    return matches / total;
  }

  calculateSemanticMatch(evidence, criteriaSet) {
    // Simple semantic matching based on claim text
    if (!evidence.claim) return 0.0;
    
    const claim = evidence.claim.toLowerCase();
    let matches = 0;
    const total = 3;

    for (const criterion of criteriaSet) {
      if (claim.includes(criterion)) {
        matches++;
      }
    }

    const score = matches / total;
    return parseFloat(score.toFixed(3));
  }

  weightedScore(details, field) {
    if (details.length === 0) return 0.0;
    
    let totalScore = 0;
    let validCount = 0;
    
    for (const detail of details) {
      if (detail[field] !== undefined) {
        totalScore += detail[field];
        validCount++;
      }
    }
    
    return validCount > 0 ? totalScore / validCount : 0.0;
  }

  computeConfidence(evidence) {
    if (!evidence || evidence.length === 0) return 0.0;
    
    let totalConfidence = 0;
    let validCount = 0;
    
    for (const item of evidence) {
      const confidence = certaintyOf(item.match_type);
      totalConfidence += confidence;
      validCount++;
    }
    
    return validCount > 0 ? totalConfidence / validCount : 0.0;
  }

  validateEvidence(evidence, thresholds = {}) {
    const defaults = {
      minCoverage: 0.5,
      minConfidence: 0.3,
      maxStale: 86400000 // 24 hours in milliseconds
    };
    
    const opts = { ...defaults, ...thresholds };
    
    return evidence.map(item => {
      const isValid = this.validateSingleEvidence(item, opts);
      return {
        ...item,
        isValid,
        validationDetails: isValid ? null : this.getValidationDetails(item, opts)
      };
    });
  }

  validateSingleEvidence(evidence, thresholds) {
    // Basic validation checks
    if (!evidence || !evidence.evidence_id) {
      return false;
    }
    
    const confidence = certaintyOf(evidence.match_type);
    
    if (confidence < thresholds.minConfidence) {
      return false;
    }
    
    if (evidence.stale) {
      const age = Date.now() - evidence.timestamp;
      if (age > thresholds.maxStale) {
        return false;
      }
    }
    
    return true;
  }

  getValidationDetails(evidence, thresholds) {
    const details = {};
    
    if (!evidence.evidence_id) {
      details.missingId = 'Evidence missing required ID';
    }
    
    const confidence = certaintyOf(evidence.match_type);
    if (confidence < thresholds.minConfidence) {
      details.lowConfidence = {
        value: confidence,
        threshold: thresholds.minConfidence
      };
    }
    
    return details;
  }

  async loadCache() {
    if (existsSync(this.cacheFile)) {
      try {
        const data = JSON.parse(readFileSync(this.cacheFile, 'utf8'));
        return data;
      } catch (e) {
        console.warn('Failed to load evaluator cache:', e);
      }
    }
    return null;
  }

  async saveCache(data) {
    try {
      const dir = this.cacheDir;
      if (!existsSync(dir)) {
        const fs = await import('fs').then(m => m.promises);
        await fs.mkdir(dir, { recursive: true });
      }
      
      const fs = await import('fs').then(m => m.promises);
      await fs.writeFile(this.cacheFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.warn('Failed to save evaluator cache:', e);
    }
  }

  clearCache() {
    try {
      const fs = require('fs').promises;
      fs.unlinkSync(this.cacheFile);
    } catch (e) {
      // File might not exist, ignore
    }
  }

  getIndexStats() {
    if (existsSync(this.indexFile)) {
      try {
        const data = JSON.parse(readFileSync(this.indexFile, 'utf8'));
        return data;
      } catch (e) {
        console.warn('Failed to load index stats:', e);
      }
    }
    return null;
  }

  async buildIndex() {
    // Simple index building - can be overridden by subclasses
    const stats = {
      timestamp: Date.now(),
      repoRoot: this.repoRoot,
      evaluatorVersion: '1.0.0'
    };
    
    await this.saveCache(stats);
    return stats;
  }

  async refreshIndex() {
    // Refresh the index with new data
    await this.buildIndex();
  }
}