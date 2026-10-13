import assert from 'node:assert/strict';
import { evaluateCompletionGate } from '../../src/integration/orchestration.js';

// P1-A: deny-by-default — an approved task with an unverified requirement must
// be gated for ANY completion phrasing, not only the DONE keyword allowlist.
const approved = {
  contract: { status: 'APPROVED', unknowns: [], assumptions: [], checks: [] },
  completionContract: { criteria: [] },
  requirements: [
    { id: 'r1', title: 'req done sin evidencia', status: 'done', evidence: [] },
  ],
  observations: [],
};

const unlisted = evaluateCompletionGate(approved, 'ya está, todo ok');
assert.equal(unlisted.blocked, true, 'unlisted DONE phrasing must not bypass the gate');
assert.ok(
  unlisted.pending.some((p) => p.includes('sin evidencia')),
  'evidence discipline must report done-without-evidence',
);

// P1-C: a non-verified requirement stays blocked (no status upgrade).
const unverified = evaluateCompletionGate(
  {
    contract: { status: 'APPROVED', unknowns: [], assumptions: [], checks: [] },
    completionContract: { criteria: [] },
    requirements: [{ id: 'r1', title: 'req', status: 'done', evidence: ['Implemented: x'] }],
    observations: [],
  },
  'done',
);
assert.equal(unverified.blocked, true, 'done without verified must stay blocked');

// P1-B: no approval escape — "aprobar contrato" and "continuar" cannot skip 
// the checks, and no autoApprove is ever returned.
const proposed = {
  contract: { status: 'PROPOSED', unknowns: [], assumptions: [], checks: [] },
  completionContract: { criteria: [] },
  requirements: [],
};
const approveMsg = evaluateCompletionGate(proposed, 'aprobar contrato');
assert.equal(approveMsg.blocked, true, '"aprobar contrato" must not bypass the gate');
assert.equal(approveMsg.autoApprove, undefined, 'autoApprove escape must be gone');

const cont = evaluateCompletionGate(proposed, 'continuar');
assert.equal(cont.blocked, true, 'explicit continuation is gated due to missing outcome contract (fail-closed)');
assert.equal(cont.autoApprove, undefined, '"continuar" must not auto-approve');

// Fast-path preservation: explicit implementation instruction skips the gate.
const impl = evaluateCompletionGate(approved, 'implementa req-2 por favor');
assert.equal(impl.blocked, true, 'explicit implementation instruction should be gated if requirement is unverified');

console.log('test-completion-gate-hardening: OK');
