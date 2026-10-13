// Deterministic episode fixtures for the artifact-outcome benchmark.
//
// Everything here is a frozen constant: no randomness, no clock, no network.
// Running the harness twice produces byte-identical reports.

export const BENCHMARK_ID = 'artifact-outcome-benchmark';
export const BENCHMARK_VERSION = 1;
export const BENCHMARK_SEED = 'artifact-outcome-v1';

const PLAN = [
  '# Implementation Plan',
  '',
  '1. Define scope',
  '2. Implement',
  '3. Verify',
  '',
].join('\n');

const SPEC_V1 = [
  '# Spec',
  '',
  'status: draft',
  'owner: agent',
  'REMOVED: legacy-note',
  '',
].join('\n');

const SPEC_V2 = [
  '# Spec',
  '',
  'status: final',
  'owner: agent',
  'ADDED: verification',
  '',
].join('\n');

/**
 * Each episode models one artifact task plus the (scripted, deterministic)
 * executor behavior for it. The same behavior is replayed under both runners;
 * only the way success is *reported* differs between baseline and WAM.
 *
 * behaviors:
 *  - faithful      writes exactly the expected artifact and reports success
 *  - noop          writes nothing but claims success
 *  - partial       writes a truncated artifact and claims success
 *  - corrupt       writes unrelated content and claims success
 *  - stale-update  leaves the initial content untouched and claims success
 *  - honest-fail   writes nothing and reports failure
 */
export const EPISODES = Object.freeze([
  { id: 'create-faithful', kind: 'create-artifact', targetPath: 'artifacts/plan.md', initial: null, expected: PLAN, behavior: 'faithful' },
  { id: 'create-silent-noop', kind: 'create-artifact', targetPath: 'artifacts/plan.md', initial: null, expected: PLAN, behavior: 'noop' },
  { id: 'create-partial', kind: 'create-artifact', targetPath: 'artifacts/plan.md', initial: null, expected: PLAN, behavior: 'partial' },
  { id: 'create-corrupt', kind: 'create-artifact', targetPath: 'artifacts/plan.md', initial: null, expected: PLAN, behavior: 'corrupt' },
  { id: 'create-honest-fail', kind: 'create-artifact', targetPath: 'artifacts/plan.md', initial: null, expected: PLAN, behavior: 'honest-fail' },
  { id: 'update-faithful', kind: 'update-artifact', targetPath: 'artifacts/spec.md', initial: SPEC_V1, expected: SPEC_V2, behavior: 'faithful', removedMarker: 'REMOVED: legacy-note', addedMarker: 'ADDED: verification' },
  { id: 'update-stale', kind: 'update-artifact', targetPath: 'artifacts/spec.md', initial: SPEC_V1, expected: SPEC_V2, behavior: 'stale-update', removedMarker: 'REMOVED: legacy-note', addedMarker: 'ADDED: verification' },
  { id: 'update-honest-fail', kind: 'update-artifact', targetPath: 'artifacts/spec.md', initial: SPEC_V1, expected: SPEC_V2, behavior: 'honest-fail' },
]);
