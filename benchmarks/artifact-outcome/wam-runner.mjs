// WAM execution runner for the artifact-outcome benchmark.
//
// Routes the same declared operations as the baseline runner through an
// event-sourced execution loop with artifact guards:
//   - create on existing artifact -> artifact-create-rejected (already-exists)
//   - update on missing artifact  -> artifact-update-rejected (not-found)
//
// Deterministic: events are numbered by sequence only — no timestamps,
// no randomness.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const WAM_RUNNER = 'wam';

/**
 * Execute declared operations with WAM semantics.
 *
 * @param {{ root: string, operations: Array<{kind:string, relPath:string, content?:string, updatedContent?:string}>, seed?: Array<{relPath:string, content?:string}> }} plan
 *   `seed` reconstructs artifacts known from prior sessions —
 *   WAM keeps more state than it sends, so the artifact
 *   registry starts populated rather than empty.
 * @returns {{ runner: 'wam', events: Array, state: { artifacts: string[] } }}
 */
export function runWam({ root, operations, seed = [] }) {
  const events = [];
  const artifacts = new Map();

  // Reconstructed state: artifacts already known to WAM.
  for (const entry of Array.isArray(seed) ? seed : [seed]) {
    if (entry && typeof entry.relPath === 'string') {
      artifacts.set(entry.relPath, entry.content ?? '');
    }
  }

  let seq = 0;

  const emit = (type, data) => {
    seq += 1;
    events.push({ seq, type, ...data });
  };

  const persist = (op) => {
    const abs = resolve(root, op.relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, op.kind === 'create-artifact' ? op.content : op.updatedContent, 'utf8');
  };

  for (const op of operations) {
    if (op.kind === 'create-artifact') {
      if (artifacts.has(op.relPath)) {
        emit('artifact-create-rejected', { relPath: op.relPath, reason: 'already-exists' });
        continue;
      }
      persist(op);
      artifacts.set(op.relPath, op.content);
      emit('artifact-created', { relPath: op.relPath, bytes: Buffer.byteLength(op.content) });
    } else if (op.kind === 'update-artifact') {
      if (!artifacts.has(op.relPath)) {
        emit('artifact-update-rejected', { relPath: op.relPath, reason: 'not-found' });
        continue;
      }
      persist(op);
      artifacts.set(op.relPath, op.updatedContent);
      emit('artifact-updated', { relPath: op.relPath, bytes: Buffer.byteLength(op.updatedContent) });
    } else {
      throw new Error(`unknown operation kind: ${op.kind}`);
    }
  }

  return { runner: WAM_RUNNER, events, state: { artifacts: [...artifacts.keys()] } };
}
