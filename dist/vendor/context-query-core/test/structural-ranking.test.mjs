import test from 'node:test';
import assert from 'node:assert';
import { structuralRankingConfig, applyStructuralRanking } from '../src/structural-ranking.js';
import { LexicalRetriever, StructuralRetriever, hybridRetrieval } from '../src/retriever.js';

function fakeProvider(importsByPath, status = { available: true }) {
  return {
    async getStatus() { return status; },
    async findSymbols() { return []; },
    async getRelationships() { return []; },
    async getFileRelationships(filePath) {
      return (importsByPath[filePath] || []).map((p) => ({ path: p, type: 'imports' }));
    }
  };
}

test('structuralRankingConfig defaults to disabled with sane bounds', () => {
  const cfg = structuralRankingConfig({});
  assert.strictEqual(cfg.enabled, false);
  assert.strictEqual(cfg.alpha, 0.5);
  assert.strictEqual(cfg.maxFiles, 40);
  assert.strictEqual(cfg.limit, 20);
});

test('structuralRankingConfig parses enablement and strength', () => {
  const cfg = structuralRankingConfig({ CF_REPOGRAPH_RANK: 'true', CF_REPOGRAPH_RANK_ALPHA: '0.25', CF_REPOGRAPH_RANK_FILES: '10' });
  assert.strictEqual(cfg.enabled, true);
  assert.strictEqual(cfg.alpha, 0.25);
  assert.strictEqual(cfg.maxFiles, 10);
});

test('disabled prior is a no-op (same reference)', async () => {
  const candidates = [{ path: 'a.js', score: 0.4 }];
  const out = await applyStructuralRanking(candidates, fakeProvider({}), structuralRankingConfig({}));
  assert.strictEqual(out, candidates);
});

test('unavailable provider is a no-op', async () => {
  const candidates = [{ path: 'a.js', score: 0.4 }];
  const cfg = { ...structuralRankingConfig({}), enabled: true };
  const out = await applyStructuralRanking(candidates, fakeProvider({}, { available: false }), cfg);
  assert.strictEqual(out, candidates);
});

test('import-consensus boosts score_final only for imported files', async () => {
  const provider = fakeProvider({ 'x.js': ['core.js'], 'y.js': ['core.js'], 'z.js': ['other.js'] });
  const candidates = [
    { path: 'core.js', score: 0.3 },
    { path: 'other.js', score: 0.3 },
    { path: 'x.js', score: 0.9 },
    { path: 'y.js', score: 0.9 },
    { path: 'z.js', score: 0.9 }
  ];
  const cfg = { ...structuralRankingConfig({}), enabled: true, alpha: 0.5 };
  const out = await applyStructuralRanking(candidates, provider, cfg);
  const core = out.find((c) => c.path === 'core.js');
  const other = out.find((c) => c.path === 'other.js');
  assert.ok(core.structural_consensus > 0, 'core has consensus');
  assert.ok(other.structural_consensus > 0, 'other has consensus from z.js');
  assert.ok(core.score_final > 0.5, 'core score_final boosted above neutral baseline');
  assert.strictEqual(core.score, 0.3, 'original score untouched');
  // x/y/z are importers, not imported by anyone in the pool
  assert.strictEqual(out.find((c) => c.path === 'x.js').score_final, undefined);
});

test('respects maxFiles bound on provider calls', async () => {
  let calls = 0;
  const provider = {
    async getStatus() { return { available: true }; },
    async getFileRelationships() { calls++; return []; }
  };
  const candidates = Array.from({ length: 50 }, (_, i) => ({ path: `f${i}.js`, score: 0.5 }));
  const cfg = { ...structuralRankingConfig({}), enabled: true, maxFiles: 7 };
  await applyStructuralRanking(candidates, provider, cfg);
  assert.strictEqual(calls, 7);
});

test('provider errors never throw and degrade to unchanged list', async () => {
  const provider = {
    async getStatus() { return { available: true }; },
    async getFileRelationships() { throw new Error('boom'); }
  };
  const candidates = [{ path: 'a.js', score: 0.5 }];
  const cfg = { ...structuralRankingConfig({}), enabled: true };
  const out = await applyStructuralRanking(candidates, provider, cfg);
  assert.deepStrictEqual(out.map((c) => c.path), ['a.js']);
  assert.strictEqual(out[0].score_final, undefined);
});

test('integration: enabled with empty relationships equals disabled pipeline', async () => {
  const provider = fakeProvider({});
  const query = 'SEARCH hybrid retrieval implementation';
  const retrievers = () => [new LexicalRetriever(), new StructuralRetriever()];
  const off = await hybridRetrieval(retrievers(), query, { budget: 8000, limit: 20 });
  const on = await hybridRetrieval(retrievers(), query, {
    budget: 8000, limit: 20, relationshipProvider: provider, rankingConfig: { ...structuralRankingConfig({}), enabled: true }
  });
  assert.deepStrictEqual(on.selected.map((c) => c.path), off.selected.map((c) => c.path));
});
