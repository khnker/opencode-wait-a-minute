import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CodeRelationshipProvider,
  relationshipConfig,
  safeStatus,
  relationshipToCandidate,
  enrichWithRelationships,
  RELATIONSHIP_TYPES,
  RESOLUTION_STATUS
} from '../src/code-relationships.js';

test('RELATIONSHIP_TYPES and RESOLUTION_STATUS are frozen contract sets', () => {
  assert.ok(Array.isArray(RELATIONSHIP_TYPES));
  assert.ok(RELATIONSHIP_TYPES.includes('imports'));
  assert.ok(RELATIONSHIP_TYPES.includes('calls'));
  assert.ok(RELATIONSHIP_TYPES.includes('routes_to'));
  assert.ok(Object.isFrozen(RELATIONSHIP_TYPES));
  assert.deepStrictEqual([...RESOLUTION_STATUS], ['resolved', 'unresolved', 'external']);
  assert.ok(Object.isFrozen(RESOLUTION_STATUS));
});

test('relationshipConfig defaults: disabled and bounded', () => {
  const cfg = relationshipConfig({});
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.depth, 1);
  assert.equal(cfg.symbolLimit, 5);
  assert.equal(cfg.relationshipLimit, 10);
  assert.equal(cfg.maxExtra, 8);
  assert.equal(cfg.fileSeeds, 5);
  assert.equal(cfg.direction, 'both');
  assert.equal(cfg.coreDir, null);
  assert.ok(Array.isArray(cfg.categories));
  assert.equal(cfg.categories.length, 0);
});

test('relationshipConfig reads CF_REPOGRAPH_* overrides', () => {
  const cfg = relationshipConfig({
    CF_REPOGRAPH_ENABLED: 'true',
    CF_REPOGRAPH_DEPTH: '3',
    CF_REPOGRAPH_SYMBOLS: '7',
    CF_REPOGRAPH_REL_LIMIT: '12',
    CF_REPOGRAPH_MAX_EXTRA: '4',
    CF_REPOGRAPH_FILE_SEEDS: '2',
    CF_REPOGRAPH_CATEGORIES: ' calls , extends ',
    CF_REPOGRAPH_DIRECTION: 'in',
    CF_REPOGRAPH_DIR: '/tmp/repograph-core'
  });
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.depth, 3);
  assert.equal(cfg.symbolLimit, 7);
  assert.equal(cfg.relationshipLimit, 12);
  assert.equal(cfg.maxExtra, 4);
  assert.equal(cfg.fileSeeds, 2);
  assert.deepStrictEqual(cfg.categories, ['calls', 'extends']);
  assert.equal(cfg.direction, 'in');
  assert.equal(cfg.coreDir, '/tmp/repograph-core');
});

test('relationshipConfig invalid/negative values fall back to defaults', () => {
  const cfg = relationshipConfig({
    CF_REPOGRAPH_DEPTH: '-5',
    CF_REPOGRAPH_SYMBOLS: 'abc',
    CF_REPOGRAPH_REL_LIMIT: '0',
    CF_REPOGRAPH_DIRECTION: 'sideways'
  });
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.depth, 1);
  assert.equal(cfg.symbolLimit, 5);
  assert.equal(cfg.relationshipLimit, 10);
  assert.equal(cfg.direction, 'both');
});

test('relationshipConfig accepts null env without throwing', () => {
  const cfg = relationshipConfig(null);
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.depth, 1);
});

test('base CodeRelationshipProvider returns empty results and unavailable status', async () => {
  const p = new CodeRelationshipProvider();
  assert.deepStrictEqual(await p.findSymbols('anything'), []);
  assert.deepStrictEqual(await p.getRelationships('sym-id'), []);
  assert.deepStrictEqual(await p.getFileRelationships('src/a.ts'), []);
  const st = await p.getStatus();
  assert.equal(st.available, false);
  assert.equal(st.reason, 'not-implemented');
});

test('safeStatus returns provider status when getStatus works', async () => {
  const p = { async getStatus() { return { available: true, index: { present: true } }; } };
  const st = await safeStatus(p);
  assert.equal(st.available, true);
  assert.equal(st.index.present, true);
});

test('safeStatus fail-open: throwing getStatus reports unavailable', async () => {
  const p = { async getStatus() { throw new Error('boom'); } };
  const st = await safeStatus(p);
  assert.equal(st.available, false);
  assert.equal(st.reason, 'status-error');
});

test('safeStatus fail-open: missing provider or getStatus', async () => {
  const stNull = await safeStatus(null);
  assert.equal(stNull.available, false);
  assert.equal(stNull.reason, 'status-error');
  const stNoMethod = await safeStatus({});
  assert.equal(stNoMethod.available, false);
  assert.equal(stNoMethod.reason, 'status-error');
});

test('safeStatus coerces non-object / null status to unavailable', async () => {
  const p = { async getStatus() { return null; } };
  const st = await safeStatus(p);
  assert.equal(st.available, false);
  assert.equal(st.reason, 'status-error');
});

test('relationshipToCandidate maps resolved confidence with clamping', () => {
  const rel = {
    source_id: 's1', target_id: 't1', type: 'calls', path: 'src/a.ts',
    line_start: 10, line_end: 12, resolution: 'resolved', confidence: 0.9
  };
  const c = relationshipToCandidate(rel);
  assert.equal(c.id, 'rel:calls:s1->t1');
  assert.equal(c.path, 'src/a.ts');
  assert.equal(c.line_start, 10);
  assert.equal(c.line_end, 12);
  assert.equal(c.score, 0.9);
  assert.equal(c.source, 'repograph');
  assert.equal(c.match_type, 'relationship:calls');
  assert.equal(c.snippet, '');
});

test('relationshipToCandidate falls back per resolution and clamps out-of-range', () => {
  const unresolved = relationshipToCandidate({ source_id: 's', target_id: 't', type: 'references', resolution: 'unresolved', path: 'a.ts', line_start: 1, line_end: 1 });
  assert.equal(unresolved.score, 0.1);
  const external = relationshipToCandidate({ source_id: 's', target_id: 't', type: 'references', resolution: 'external', path: 'a.ts', line_start: 1, line_end: 1 });
  assert.equal(external.score, 0.15);
  const over = relationshipToCandidate({ source_id: 's', target_id: 't', type: 'references', resolution: 'resolved', confidence: 5, path: 'a.ts', line_start: 1, line_end: 1 });
  assert.equal(over.score, 1);
  const under = relationshipToCandidate({ source_id: 's', target_id: 't', type: 'references', resolution: 'resolved', confidence: -3, path: 'a.ts', line_start: 1, line_end: 1 });
  assert.equal(under.score, 0);
});

test('enrichWithRelationships returns [] when disabled or unavailable', async () => {
  const provider = {
    async getStatus() { return { available: true }; },
    async findSymbols() { return [{ id: 's1' }]; },
    async getRelationships() { return []; }
  };
  assert.deepStrictEqual(await enrichWithRelationships([], provider, relationshipConfig({})), []);
  const off = { ...relationshipConfig({}), enabled: true };
  const unavailable = {
    async getStatus() { return { available: false, reason: 'off' }; },
    async findSymbols() { return [{ id: 's1' }]; },
    async getRelationships() { return []; }
  };
  assert.deepStrictEqual(await enrichWithRelationships([], unavailable, off), []);
  assert.deepStrictEqual(await enrichWithRelationships([], null, off), []);
});

test('enrichWithRelationships maps relationships, dedups by path, respects maxExtra', async () => {
  const rels = [
    { source_id: 's1', target_id: 't1', type: 'calls', direction: 'out', path: 'src/a.ts', line_start: 1, line_end: 2, detection: 'static', resolution: 'resolved', confidence: 0.8 },
    { source_id: 's1', target_id: 't2', type: 'imports', direction: 'out', path: 'src/a.ts', line_start: 3, line_end: 4, detection: 'static', resolution: 'resolved', confidence: 0.7 },
    { source_id: 's1', target_id: 't3', type: 'extends', direction: 'out', path: 'src/b.ts', line_start: 5, line_end: 6, detection: 'static', resolution: 'resolved', confidence: 0.6 }
  ];
  const provider = {
    async getStatus() { return { available: true }; },
    async findSymbols() { return [{ id: 's1', name: 'Foo' }]; },
    async getRelationships() { return rels; }
  };
  const cfg = { ...relationshipConfig({}), enabled: true, maxExtra: 1 };
  const out = await enrichWithRelationships([{ path: 'src/a.ts', line_start: 0, line_end: 0 }], provider, cfg);
  assert.equal(out.length, 1);
  assert.equal(out[0].path, 'src/b.ts');
  assert.equal(out[0].score, 0.6);
});

test('enrichWithRelationships tolerates throwing provider methods', async () => {
  const provider = {
    async getStatus() { return { available: true }; },
    async findSymbols() { throw new Error('nope'); },
    async getRelationships() { return []; }
  };
  const cfg = { ...relationshipConfig({}), enabled: true };
  assert.deepStrictEqual(await enrichWithRelationships([], provider, cfg), []);
});
