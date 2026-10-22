// EDITED FILE: src/context/context-dictionary.js
// OpenSpec Change: add-context-dictionary
// Implements ContextDictionary with structural index, semantic dictionary,
// change detection, lifecycle management, and reconciliation.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function calculateContentHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
  } catch {
    return null;
  }
}

export class Evidence {
  constructor({ type, value, source, timestamp = new Date().toISOString() }) {
    this.type = type;
    this.value = value;
    this.source = source;
    this.timestamp = timestamp;
  }

  static fromObject(obj) {
    return new Evidence({
      type: obj.type,
      value: obj.value,
      source: obj.source,
      timestamp: obj.timestamp,
    });
  }

  toJSON() {
    return {
      type: this.type,
      value: this.value,
      source: this.source,
      timestamp: this.timestamp,
    };
  }
}

export class StructuralIndexEntry {
  constructor({ path, hash, symbols = [], exports = [], imports = [], module = null, repositoryId, indexerVersion = "1.0.0" }) {
    this.path = path;
    this.hash = hash;
    this.symbols = symbols;
    this.exports = exports;
    this.imports = imports;
    this.module = module;
    this.repositoryId = repositoryId;
    this.indexerVersion = indexerVersion;
    this.updatedAt = new Date().toISOString();
  }

  static fromObject(obj) {
    return new StructuralIndexEntry(obj);
  }
}

export class SemanticDictionaryEntry {
  constructor({ concept, targets = [], aliases = [], confidence = 0, evidence = [], status = "discovered" }) {
    this.concept = concept;
    this.targets = targets;
    this.aliases = aliases;
    this.confidence = confidence;
    this.evidence = evidence.map((e) => (e instanceof Evidence ? e : Evidence.fromObject(e)));
    this.status = status;
    this.updatedAt = new Date().toISOString();
  }

  static fromObject(obj) {
    return new SemanticDictionaryEntry(obj);
  }
}

/**
 * @typedef {Object} ResolutionCandidate
 * @property {string} path - File path
 * @property {number} confidence - Confidence score 0-1
 * @property {Evidence[]} evidence - Supporting evidence
 * @property {string} status - discovered | candidate | confirmed | invalid
 */

export class ResolutionCandidate {
  constructor({ path, confidence, evidence, status }) {
    this.path = path;
    this.confidence = confidence;
    this.evidence = evidence;
    this.status = status;
  }
}

export class ContextDictionary {
  INDEXER_VERSION = "1.0.0";

  constructor(root = process.cwd()) {
    this.root = root;
    this.filePath = path.join(root, ".wam", "context-dictionary.json");
    this.structuralIndex = new Map();
    this.semanticDictionary = new Map();
    this.repositoryId = path.basename(root);
    this.load();
  }

  load() {
    if (fs.existsSync(this.filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
        if (data.indexerVersion !== this.INDEXER_VERSION) {
          return;
        }
        this.repositoryId = data.repositoryId || this.repositoryId;
        this.structuralIndex = new Map(
          Object.entries(data.structuralIndex || {}).map(([k, v]) => [
            k,
            StructuralIndexEntry.fromObject(v),
          ])
        );
        this.semanticDictionary = new Map(
          Object.entries(data.semanticDictionary || {}).map(([k, v]) => [
            k,
            SemanticDictionaryEntry.fromObject(v),
          ])
        );
      } catch {
        this.structuralIndex = new Map();
        this.semanticDictionary = new Map();
      }
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(
      this.filePath,
      JSON.stringify(
        {
          repositoryId: this.repositoryId,
          indexerVersion: this.INDEXER_VERSION,
          structuralIndex: Object.fromEntries(
            Array.from(this.structuralIndex.entries()).map(([k, v]) => [
              k,
              v,
            ])
          ),
          semanticDictionary: Object.fromEntries(
            Array.from(this.semanticDictionary.entries()).map(([k, v]) => [
              k,
              v,
            ])
          ),
        },
        null,
        2
      )
    );
  }

  // --- Structural Index ---

  indexFile(filePath, options = {}) {
    const hash = calculateContentHash(filePath);
    if (!hash) return null;

    const relPath = path.relative(this.root, filePath);
    const entry = new StructuralIndexEntry({
      path: relPath,
      hash,
      repositoryId: this.repositoryId,
      ...options,
    });

    this.structuralIndex.set(relPath, entry);
    this.save();
    return entry;
  }

  indexFiles(files = []) {
    const entries = [];
    for (const file of files) {
      const entry = this.indexFile(file);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  invalidateFile(filePath) {
    const relPath = path.relative(this.root, filePath);
    if (this.structuralIndex.has(relPath)) {
      this.structuralIndex.delete(relPath);
      this.save();
    }
  }

  invalidateFiles(files = []) {
    for (const file of files) {
      this.invalidateFile(file);
    }
  }

  getFileEntry(filePath) {
    const relPath = path.relative(this.root, filePath);
    return this.structuralIndex.get(relPath) || null;
  }

  getFilesByPattern(pattern) {
    const regex = new RegExp(pattern);
    return Array.from(this.structuralIndex.entries()).filter(([k]) =>
      regex.test(k)
    );
  }

  findSymbol(symbolName) {
    const results = [];
    for (const [filePath, entry] of this.structuralIndex.entries()) {
      if (entry.symbols && entry.symbols.includes(symbolName)) {
        results.push({ filePath, entry });
      }
    }
    return results;
  }

  getDependents(filePath) {
    const relPath = path.relative(this.root, filePath);
    const dependents = [];
    for (const [depPath, depEntry] of this.structuralIndex.entries()) {
      if (
        depEntry.imports &&
        (depEntry.imports.includes(relPath) ||
          depEntry.imports.includes(filePath))
      ) {
        dependents.push({ filePath: depPath, entry: depEntry });
      }
    }
    return dependents;
  }

  // --- Change Detection ---

  async detectChanges(gitDir = this.root) {
    const gitHead = path.join(gitDir, ".git", "HEAD");
    const changes = {
      added: [],
      modified: [],
      deleted: [],
      renamed: [],
      branchChanged: false,
    };

    try {
      if (fs.existsSync(gitHead)) {
        let refName = "main";
        try {
          const headContent = fs.readFileSync(gitHead, "utf-8").trim();
          if (headContent.startsWith("ref:")) {
            refName = headContent.replace("ref: refs/heads/", "").trim();
          }
        } catch {}

        if (this.currentBranch && this.currentBranch !== refName) {
          changes.branchChanged = true;
        }
        this.currentBranch = refName;
      }
    } catch {}

    const trackedPaths = new Set(this.structuralIndex.keys());
    const currentFiles = this._scanRepositoryFiles();

    for (const relPath of currentFiles) {
      if (!trackedPaths.has(relPath)) {
        changes.added.push(relPath);
      }
    }

    for (const relPath of trackedPaths) {
      const fullPath = path.join(this.root, relPath);
      if (!fs.existsSync(fullPath)) {
        changes.deleted.push(relPath);
      } else {
        const existingEntry = this.structuralIndex.get(relPath);
        const currentHash = calculateContentHash(fullPath);
        if (existingEntry && existingEntry.hash !== currentHash) {
          changes.modified.push(relPath);
        }
      }
    }

    const deletedSet = new Set(changes.deleted);
    const modifiedSet = new Set(changes.modified);

    for (const relPath of changes.added) {
      for (const delPath of deletedSet) {
        const fullPath = path.join(this.root, relPath);
        const deletedEntry = this.structuralIndex.get(delPath);
        if (
          deletedEntry &&
          this._pathsLikelyRenamed(fullPath, delPath, deletedEntry)
        ) {
          changes.renamed.push({ from: delPath, to: relPath });
          deletedSet.delete(delPath);
          changes.added.splice(changes.added.indexOf(relPath), 1);
          break;
        }
      }
    }

    changes.deleted = Array.from(deletedSet);
    return changes;
  }

  _scanRepositoryFiles() {
    const files = [];
    const gitignore = this._loadGitignore();

    const walk = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith(".") && entry.name !== ".wam") continue;
          const fullPath = path.join(dir, entry.name);
          if (gitignore.some((pattern) => this._matchIgnore(fullPath, pattern))) {
            continue;
          }
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.isFile()) {
            files.push(path.relative(this.root, fullPath));
          }
        }
      } catch {}
    };

    walk(this.root);
    return files;
  }

  _loadGitignore() {
    const gitignorePath = path.join(this.root, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
      try {
        return fs
          .readFileSync(gitignorePath, "utf-8")
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("#"));
      } catch {}
    }
    return [];
  }

  _matchIgnore(filePath, pattern) {
    return filePath.includes(pattern);
  }

  _pathsLikelyRenamed(newPath, oldPath, oldEntry) {
    try {
      const newContent = fs.readFileSync(path.join(this.root, newPath), "utf-8");
      const symbols = this._extractSymbols(newContent);
      if (oldEntry.symbols && symbols.length > 0) {
        const overlap = oldEntry.symbols.filter((s) =>
          symbols.includes(s)
        );
        return overlap.length / Math.max(oldEntry.symbols.length, 1) > 0.5;
      }
      return Math.abs(newContent.length - oldEntry.hash.length) < 1000;
    } catch {
      return false;
    }
  }

  // --- Semantic Dictionary ---

  addAssociation(concept, target, options = {}) {
    const { confidence = 0.5, evidence = [], aliases = [], status = "candidate" } =
      options;

    let entry = this.semanticDictionary.get(concept);
    const evidenceObjects = evidence.map(
      (e) => (e instanceof Evidence ? e : Evidence.fromObject(e))
    );

    if (!entry) {
      entry = new SemanticDictionaryEntry({
        concept,
        targets: [target],
        aliases,
        confidence,
        evidence: evidenceObjects,
        status,
      });
    } else {
      if (!entry.targets.includes(target)) {
        entry.targets.push(target);
      }
      if (confidence > entry.confidence) {
        entry.confidence = confidence;
      }
      if (status === "confirmed" && entry.status !== "confirmed") {
        entry.status = status;
      }
      entry.evidence.push(...evidenceObjects);
    }

    entry.updatedAt = new Date().toISOString();
    this.semanticDictionary.set(concept, entry);
    this.save();
    return entry;
  }

  promoteToConfirmed(concept, evidence = null) {
    const entry = this.semanticDictionary.get(concept);
    if (!entry) return null;

    entry.status = "confirmed";
    entry.confidence = Math.min(entry.confidence + 0.3, 1.0);
    if (evidence) {
      entry.evidence.push(
        evidence instanceof Evidence ? evidence : Evidence.fromObject(evidence)
      );
    }
    entry.updatedAt = new Date().toISOString();
    this.save();
    return entry;
  }

  invalidateAssociation(concept) {
    const entry = this.semanticDictionary.get(concept);
    if (entry) {
      entry.status = "invalid";
      entry.updatedAt = new Date().toISOString();
      this.semanticDictionary.set(concept, entry);
      this.save();
    }
    return entry;
  }

  removeAssociation(concept) {
    return this.semanticDictionary.delete(concept);
  }

  getConceptEntry(concept) {
    return this.semanticDictionary.get(concept) || null;
  }

  addAlias(concept, alias) {
    const entry = this.semanticDictionary.get(concept);
    if (!entry) {
      return null;
    }
    if (!entry.aliases.includes(alias)) {
      entry.aliases.push(alias);
      entry.updatedAt = new Date().toISOString();
      this.save();
    }
    return entry;
  }

  resolveConcept(concept) {
    let entry = this.semanticDictionary.get(concept);
    if (!entry) {
      for (const [c, e] of this.semanticDictionary.entries()) {
        if (e.aliases && e.aliases.includes(concept)) {
          entry = e;
          break;
        }
      }
    }

    if (!entry || entry.status === "invalid") {
      return { candidates: [], source: null };
    }

    const candidates = entry.targets.map((target) => new ResolutionCandidate({
      path: target,
      confidence: entry.confidence,
      evidence: entry.evidence || [],
      status: entry.status,
    }));

    return {
      candidates: candidates.sort((a, b) => b.confidence - a.confidence),
      source: "dictionary",
      entry,
    };
  }

  resolveConcepts(concepts = []) {
    const results = {};
    for (const concept of concepts) {
      results[concept] = this.resolveConcept(concept);
    }
    return results;
  }

  getConfirmedAssociations() {
    const result = [];
    for (const [concept, entry] of this.semanticDictionary.entries()) {
      if (entry.status === "confirmed") {
        result.push({ concept, entry });
      }
    }
    return result;
  }

  getCandidateAssociations() {
    const result = [];
    for (const [concept, entry] of this.semanticDictionary.entries()) {
      if (entry.status === "candidate" || entry.status === "discovered") {
        result.push({ concept, entry });
      }
    }
    return result;
  }

  // --- Reconciliation ---

  detectStaleEntries() {
    const stale = [];
    for (const [concept, entry] of this.semanticDictionary.entries()) {
      for (const target of entry.targets) {
        if (!this.structuralIndex.has(target)) {
          stale.push({ concept, entry, reason: `target ${target} not in structural index` });
        }
      }
    }
    return stale;
  }

  rebuildIndex(options = {}) {
    const { dryRun = false, preserveSemantic = true } = options;

    const oldSemantic = preserveSemantic
      ? new Map(this.semanticDictionary)
      : new Map();

    const oldStructural = new Map(this.structuralIndex);
    this.structuralIndex = new Map();
    if (!preserveSemantic) {
      this.semanticDictionary = new Map();
    }

    const currentFiles = this._scanRepositoryFiles();
    for (const relPath of currentFiles) {
      const fullPath = path.join(this.root, relPath);
      const entry = this.indexFile(fullPath);
      if (!entry && oldStructural.has(relPath)) {
        this.structuralIndex.set(relPath, oldStructural.get(relPath));
      }
    }

    if (preserveSemantic) {
      for (const [concept, entry] of oldSemantic.entries()) {
        const stillValid = entry.targets.filter((t) =>
          this.structuralIndex.has(t)
        );
        if (stillValid.length > 0) {
          entry.targets = stillValid;
          entry.updatedAt = new Date().toISOString();
          this.semanticDictionary.set(concept, entry);
        }
      }
    }

    const stale = this.detectStaleEntries();
    for (const { concept, reason } of stale) {
      this.invalidateAssociation(concept);
    }

    if (!dryRun) {
      this.save();
    }

    return {
      indexed: this.structuralIndex.size,
      semantic: this.semanticDictionary.size,
      staleInvalidated: stale.length,
    };
  }

  // --- Integration Helpers ---

  /**
   * Get candidate targets for a concept, falling back to structural search.
   */
  getCandidates(concept) {
    const resolved = this.resolveConcept(concept);
    if (resolved.candidates.length > 0) {
      return resolved.candidates;
    }

    const symbolMatches = this.findSymbol(concept);
    return symbolMatches.map(({ filePath, entry }) => new ResolutionCandidate({
      path: filePath,
      confidence: 0.3,
      evidence: [],
      status: "discovered",
    }));
  }

  /**
   * Get context candidates from the dictionary for a list of mentioned concepts.
   * Returns Map of concept -> array of candidates.
   */
  getContextCandidates(concepts) {
    const result = new Map();
    for (const concept of concepts) {
      result.set(concept, this.getCandidates(concept));
    }
    return result;
  }
}

export default ContextDictionary;
