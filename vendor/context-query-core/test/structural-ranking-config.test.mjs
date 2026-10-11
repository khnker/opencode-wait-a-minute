import test from 'node:test';
import assert from 'node:assert/strict';
import {
  structuralRankingConfig,
  applyStructuralRanking
} from '../src/structural-ranking.js';

test('structuralRankingConfig defaults to disabled with sane bounds', () => {
  const cfg = structuralRankingConfig({});
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.alpha, 0.5);
  assert.equal(cfg.maxFiles, 40);
  assert.equal(cfg.limit, 20);
});

test('structuralRankingConfig reads CF_REPOGRAPH_RANK_* overrides', () => {
  const cfg = structuralRankingConfig({
    CF_REPOGRAPH_RANK: 'on',
    CF_REPOGRAPH_RANK_ALPHA: '0.25',
    CF_REPOGRAPH_RANK_FILES: '100',
    CF_REPOGRAPH_RANK_LIMIT: '5'
  });
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.alpha, 0.25);
  assert.equal(cfg.maxFiles, 100);
  assert.equal(cfg.limit, 5);
});

test('structuralRankingConfig accepts truthy variants and clamps invalid values', () => {
  for (const v of ['1', 'true', 'yes', 'on', 'TRUE']) {
    assert.equal(structuralRankingConfig({ CF_REPOGRAPH_RANK: v }).enabled, true, v);
  }
  const bad = structuralRankingConfig({
    CF_REPOGRAPH_RANK: 'maybe',
    CF_REPOGRAPH_RANK_ALPHA: 'not-a-number',
    CF_REPOGRAPH_RANK_FILES: '-3',
    CF_REPOGRAPH_RANK_LIMIT: '0'
  });
  assert.equal(bad.enabled, false);
  assert.equal(bad.alpha, 0.5);
  assert.equal(bad.maxFiles, 40);
  assert.equal(bad.limit, 20);
});

test('structuralRankingConfig handles null env', () => {
  const cfg = structuralRankingConfig(null);
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.alpha, 0.5);
});

test('applyStructuralRanking returns input unchanged when disabled', async () => {
  const candidates = [{ path: 'src/a.ts', score_final: 0.5 }];
  const provider = {
    async getStatus() { return { available: true }; },
    async getFileRelationships() { return [{ path: 'src/a.ts' }]; }
  };
  const out = await applyStructuralRanking(candidates, provider, structuralRankingConfig({}));
  assert.deepStrictEqual(out, candidates);
});

test('applyStructuralRanking returns input unchanged for empty candidates', async () => {
  const provider = {
    async getStatus() { return { available: true }; },
    async getFileRelationships() { return [{ path: 'src/a.ts' }]; }
  };
  const cfg = structuralRankingConfig({ CF_REPOGRAPH_RANK: '1' });
  assert.deepStrictEqual(await applyStructuralRanking([], provider, cfg), []);
  assert.deepStrictEqual(await applyStructuralRanking(null, provider, cfg), null);
  assert.deepStrictEqual(await applyStructuralRanking([], null, cfg), []);
});

test('applyStructuralRanking returns input unchanged when provider unavailable', async () => {
  const candidates = [{ path: 'src/a.ts', score_final: 0.5 }];
  const provider = {
    async getStatus() { return { available: false, reason: 'off' }; },
    async getFileRelationships() { return [{ path: 'src/a.ts' }]; }
  };
  const cfg = structuralRankingConfig({ CF_REPOGRAPH_RANK: '1' });
  const out = await applyStructuralRanking(candidates, provider, cfg);
  assert.deepStrictEqual(out, candidates);
});

test('applyStructuralRanking returns input unchanged when consensus is empty', async () => {
  const candidates = [{ path: 'src/a.ts', score_final: 0.5 }];
  const provider = {
    async getStatus() { return { available: true }; },
    async getFileRelationships() { return []; }
  };
  const cfg = structuralRankingConfig({ CF_REPOGRAPH_RANK: '1' });
  const out = await applyStructuralRanking(candidates, provider, cfg);
  assert.deepStrictEqual(out, candidates);
});

test('applyStructuralRanking boosts candidates by import consensus', async () => {
  const candidates = [
    { path: 'src/a.ts', score_final: 0.5 },
    { path: 'src/b.ts', score_final: 0.4 }
  ];
  const provider = {
    async getStatus() { return { available: true }; },
    async getFileRelationships(filePath) {
      // a.ts is imported by both pool members; b.ts by none.
      return filePath === 'src/a.ts'
        ? [{ path: 'src/a.ts' }, { path: 'src/a.ts' }]
        : [];
    }
  };
  const cfg = structuralRankingConfig({ CF_REPOGRAPH_RANK: '1', CF_REPOGRAPH_RANK_ALPHA: '1' });
  const out = await applyStructuralRanking(candidates, provider, cfg);
  assert.equal(out.length, 2);
  assert.ok(out[0].score_final > 0.5);
  assert.equal(out[0].structural_consensus, 1);
  assert.equal(out[1].score_final, 0.4);
  assert.equal(out[1].structural_consensus, undefined);
});

test('applyStructuralRanking tolerates throwing provider methods', async () => {
  const candidates = [{ path: 'src/a.ts', score_final: 0.5 }];
  const provider = {
    async getStatus() { return { available: true }; },
    async getFileRelationships() { throw new Error('boom'); }
  };
  const cfg = structuralRankingConfig({ CF_REPOGRAPH_RANK: '1' });
  const out = await applyStructuralRanking(candidates, provider, cfg);
  assert.deepStrictEqual(out, candidates);
});
