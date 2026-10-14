import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  IMPECCABLE_PROVENANCE,
  CAPABILITY_STATES,
  isImpeccableEnabled,
  detectImpeccable,
  getCapabilityState,
  classifyFrontendUxTask,
  planFrontendUxInvocation,
  describeCapability,
} from './impeccable-integration.js';

const SOURCE_URL = new URL('./impeccable-integration.js', import.meta.url);

test('isImpeccableEnabled accepts only explicit truthy flags', () => {
  assert.equal(isImpeccableEnabled({}), false);
  assert.equal(isImpeccableEnabled({ WAM_IMPECCABLE: '0' }), false);
  assert.equal(isImpeccableEnabled({ WAM_IMPECCABLE: 'off' }), false);
  for (const value of ['1', 'true', 'on', 'enabled', 'TRUE', 'On', 'ENABLED']) {
    assert.equal(isImpeccableEnabled({ WAM_IMPECCABLE: value }), true, value);
  }
});

test('detectImpeccable uses the injectable probe and swallows probe errors', () => {
  assert.equal(detectImpeccable({ probe: () => true }), true);
  assert.equal(detectImpeccable({ probe: () => false }), false);
  assert.equal(
    detectImpeccable({
      probe: () => {
        throw new Error('boom');
      },
    }),
    false
  );
});

test('(a) probe true + WAM_IMPECCABLE unset → DISABLED', () => {
  const state = getCapabilityState({ env: {}, probe: () => true });
  assert.equal(state, CAPABILITY_STATES.DISABLED);
  assert.equal(describeCapability(state).enabled, false);
});

test('(b) probe false → UNAVAILABLE and fallback is set', () => {
  const state = getCapabilityState({ env: { WAM_IMPECCABLE: '1' }, probe: () => false });
  assert.equal(state, CAPABILITY_STATES.UNAVAILABLE);

  const described = describeCapability(state);
  assert.equal(described.available, false);
  assert.equal(described.enabled, false);
  assert.ok(described.fallback, 'fallback must be set when not ENABLED');
  assert.match(described.fallback, /no Impeccable audit performed/);
});

test('(c) probe true + WAM_IMPECCABLE=1 → ENABLED and plans a frontend UX task', () => {
  const env = { WAM_IMPECCABLE: '1' };
  const state = getCapabilityState({ env, probe: () => true });
  assert.equal(state, CAPABILITY_STATES.ENABLED);

  const described = describeCapability(state);
  assert.equal(described.available, true);
  assert.equal(described.enabled, true);
  assert.equal(described.fallback, null);

  const task = {
    description: 'fix responsive layout in the header component',
    files: ['src/components/Header.tsx'],
  };
  const plan = planFrontendUxInvocation(task, state);
  assert.equal(plan.activate, true);
  assert.equal(plan.capability, 'impeccable');
  assert.equal(plan.command, 'critique');
  assert.equal(plan.invocation, '/impeccable critique');
  assert.equal(plan.reason, 'enabled');
});

test('(d) backend-only task is not frontend UX and never activates, even when ENABLED', () => {
  const state = CAPABILITY_STATES.ENABLED;
  const task = {
    description: 'add a sql migration for the users database table',
    files: ['src/db/migrations/001-users.sql'],
  };

  const classified = classifyFrontendUxTask(task);
  assert.equal(classified.isFrontendUx, false);
  assert.ok(classified.reasons.some((r) => r.startsWith('backend signal:')));

  const plan = planFrontendUxInvocation(task, state);
  assert.equal(plan.activate, false);
  assert.equal(plan.capability, null);
  assert.equal(plan.command, null);
  assert.equal(plan.invocation, null);
  assert.equal(plan.reason, 'not frontend UX task');
});

test('(d2) string backend task (endpoint/dto) is not frontend UX', () => {
  const classified = classifyFrontendUxTask(
    'add a new endpoint and dto for the invoices service'
  );
  assert.equal(classified.isFrontendUx, false);
});

test('(d3) mixed task with any frontend signal still qualifies', () => {
  const classified = classifyFrontendUxTask({
    description: 'wire the new ui screen to the api endpoint',
    files: ['src/app/dashboard/page.tsx', 'src/api/dashboard.js'],
  });
  assert.equal(classified.isFrontendUx, true);
});

test('(e) unknown intent falls back to default command without fabricating success', () => {
  const plan = planFrontendUxInvocation(
    { description: 'wobble the frobnication component' },
    CAPABILITY_STATES.ENABLED
  );
  assert.equal(plan.activate, true);
  assert.equal(plan.command, 'critique');
  assert.equal(plan.invocation, '/impeccable critique');
  assert.doesNotMatch(JSON.stringify(plan), /completed/i);
  assert.doesNotMatch(JSON.stringify(plan), /success/i);
});

test('(e2) known intents map to their commands', () => {
  const at = CAPABILITY_STATES.ENABLED;
  const describe = (intent) => ({ description: `ui ${intent}`, kind: intent });

  assert.equal(planFrontendUxInvocation(describe('review'), at).command, 'critique');
  assert.equal(planFrontendUxInvocation(describe('diagnose'), at).command, 'critique');
  assert.equal(planFrontendUxInvocation(describe('audit'), at).command, 'audit');
  assert.equal(planFrontendUxInvocation(describe('verify'), at).command, 'audit');
  assert.equal(planFrontendUxInvocation(describe('accessibility'), at).command, 'audit');
  assert.equal(planFrontendUxInvocation(describe('design'), at).command, 'shape');
  assert.equal(planFrontendUxInvocation(describe('refine'), at).command, 'polish');
  assert.equal(planFrontendUxInvocation(describe('polish'), at).command, 'polish');
});

test('planning is inert unless the capability is ENABLED', () => {
  const task = { description: 'fix the responsive layout', files: ['src/ui/card.css'] };
  for (const state of [CAPABILITY_STATES.UNAVAILABLE, CAPABILITY_STATES.DISABLED]) {
    const plan = planFrontendUxInvocation(task, state);
    assert.equal(plan.activate, false);
    assert.equal(plan.capability, null);
    assert.equal(plan.invocation, null);
    assert.equal(plan.reason, `capability ${state}`);
  }
});

test('(f) provenance is recorded verbatim', () => {
  assert.deepEqual(IMPECCABLE_PROVENANCE, {
    Repo: 'https://github.com/pbakaus/impeccable',
    License: 'Apache-2.0',
    Version: '4.5.2',
    Tag: 'skill-v4.5.2',
    Commit: '2f98774f86bc05563876643db37e6c37c322850f',
    Install: 'npx impeccable install',
    Invocation: 'slash-command+skill',
    CommandBridge: '.opencode/commands/impeccable.md',
  });
  assert.ok(Object.isFrozen(IMPECCABLE_PROVENANCE));
  assert.deepEqual(describeCapability(CAPABILITY_STATES.DISABLED).provenance, IMPECCABLE_PROVENANCE);
});

test('(g) source has no network or child_process imports', () => {
  const source = fs.readFileSync(SOURCE_URL, 'utf8');
  const forbidden = /from\s+['"](?:node:)?(http|https|net|tls|child_process)['"]/g;
  const matches = source.match(forbidden) || [];
  assert.deepEqual(matches, [], `forbidden imports found: ${matches.join(', ')}`);
  assert.doesNotMatch(source, /require\(\s*['"](?:node:)?(http|https|net|tls|child_process)['"]/);
});
