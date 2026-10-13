// Baseline execution runner for the artifact-outcome benchmark.
//
// Applies declared artifact operations directly to the filesystem
// with no WAM state, guards, or events — this is the control arm
// the WAM runner is compared against.
//
// Deterministic: operations are numbered by sequence only — no
// timestamps, no randomness.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const BASELINE_RUNNER = 'baseline';

/**
 * Execute declared operations with plain filesystem semantics.
 * @param {{ root: string, operations: Array<{kind:string, relPath:string, content?:string, updatedContent?:string}> }} plan
 * @returns {{ runner: 'baseline', executed: Array<{seq:number, kind:string, relPath:string}> }}
 */
export function runBaseline({ root, operations }) {
  const executed = [];
  let seq = 0;

  const persist = (op) => {
    const abs = resolve(root, op.relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(
      abs,
      op.kind === 'create-artifact' ? op.content : op.updatedContent,
      'utf8',
    );
  };

  for (const op of operations) {
    seq += 1;
    if (op.kind !== 'create-artifact' && op.kind !== 'update-artifact') {
      throw new Error(`unknown operation kind: ${op.kind}`);
    }
    persist(op);
    executed.push({ seq, kind: op.kind, relPath: op.relPath });
  }

  return { runner: BASELINE_RUNNER, executed };
}
