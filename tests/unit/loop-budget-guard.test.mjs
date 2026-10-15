import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createLoopBudgetGuard } from '../../src/execution/loop-budget-guard.js';

test("identical calls below threshold → repeated=false", () => {
  const guard = createLoopBudgetGuard({ stepBudget: 120, perToolThreshold: 3, streakThreshold: 100 });
  const r1 = guard.record("toolA", { x: 1 });
  const r2 = guard.record("toolA", { x: 1 });
  const r3 = guard.record("toolA", { x: 1 });
  assert.strictEqual(r1.repeated, false);
  assert.strictEqual(r2.repeated, false);
  assert.strictEqual(r3.repeated, true); // >= perToolThreshold
});

test("at threshold → CHECKPOINT", () => {
  const guard = createLoopBudgetGuard({ stepBudget: 120, perToolThreshold: 3, streakThreshold: 100 });
  guard.noteStateChange();
  const r1 = guard.record("toolB", { y: 2 });
  const r2 = guard.record("toolB", { y: 2 });
  const r3 = guard.record("toolB", { y: 2 });
  assert.strictEqual(r3.directive, "CHECKPOINT");
  assert.strictEqual(r3.count, 3);
});

test(">=2x threshold → ESCALATE", () => {
  const guard = createLoopBudgetGuard({ stepBudget: 120, perToolThreshold: 3, streakThreshold: 100 });
  guard.noteStateChange();
  for (let i = 0; i < 5; i++) guard.record("toolC", { z: 3 });
  const r6 = guard.record("toolC", { z: 3 });
  assert.strictEqual(r6.directive, "ESCALATE");
});

test("distinct inputs independent", () => {
  const guard = createLoopBudgetGuard({ perToolThreshold: 2 });
  const r1 = guard.record("toolD", { a: 1 });
  const r2 = guard.record("toolD", { a: 2 });
  assert.strictEqual(r1.repeated, false);
  assert.strictEqual(r2.repeated, false);
});

test("noteStateChange resets counters for one tool", () => {
  const guard = createLoopBudgetGuard({ perToolThreshold: 2 });
  guard.record("toolE", { f: 1 });
  guard.record("toolE", { f: 1 });
  guard.noteStateChange("toolE");
  const r = guard.record("toolE", { f: 1 });
  assert.strictEqual(r.repeated, false);
  assert.strictEqual(r.count, 1);
});

test("noteStateChange() resets all tools", () => {
  const guard = createLoopBudgetGuard({ perToolThreshold: 2 });
  guard.record("toolE1", { f: 1 });
  guard.record("toolE1", { f: 1 });
  guard.record("toolE2", { f: 1 });
  guard.record("toolE2", { f: 1 });
  guard.noteStateChange();
  const r1 = guard.record("toolE1", { f: 1 });
  const r2 = guard.record("toolE2", { f: 1 });
  assert.strictEqual(r1.repeated, false);
  assert.strictEqual(r2.repeated, false);
});

test("stepBudget reached → STOP_CHECKPOINT", () => {
  const guard = createLoopBudgetGuard({ stepBudget: 3, perToolThreshold: 5 });
  guard.record("toolF", { g: 1 });
  guard.record("toolF", { g: 1 });
  guard.record("toolF", { g: 1 }); // steps = 3
  const r = guard.record("toolF", { g: 1 });
  assert.strictEqual(r.budgetExhausted, true);
  assert.strictEqual(r.directive, "STOP_CHECKPOINT");
});

test("input with object key order differences normalizes to same key", () => {
  const guard = createLoopBudgetGuard({ perToolThreshold: 2 });
  const r1 = guard.record("toolG", { a: 1, b: { c: 2 } });
  const r2 = guard.record("toolG", { b: { c: 2 }, a: 1 });
  assert.strictEqual(r1.key, r2.key);
  assert.strictEqual(r1.repeated, false);
  assert.strictEqual(r2.repeated, true);
});

test("malformed (circular) input doesn’t throw", () => {
  const guard = createLoopBudgetGuard({ perToolThreshold: 2 });
  const circular = { a: 1 };
  circular.self = circular;
  const r1 = guard.record("toolH", circular);
  const r2 = guard.record("toolH", circular);
  assert.strictEqual(r1.key, "toolH"); // fail-open fallback key
  assert.strictEqual(r2.repeated, true);
});

test("deterministic with injectable now", () => {
  let time = 1000;
  const guard = createLoopBudgetGuard({ now: () => time });
  guard.record("toolI", { t: 1 });
  time = 2000;
  guard.record("toolI", { t: 1 });
  time = 3000;
  const r3 = guard.record("toolI", { t: 1 });
  assert.strictEqual(r3.repeated, true);
});

test("snapshot/restore round-trips", () => {
  const guard = createLoopBudgetGuard({ stepBudget: 10, perToolThreshold: 2 });
  guard.record("toolJ", { k: 1 });
  const snap = guard.snapshot();
  const restored = createLoopBudgetGuard({ stepBudget: 10, perToolThreshold: 2 });
  restored.restore(snap);
  const r = restored.record("toolJ", { k: 1 });
  assert.strictEqual(r.count, 2);
  assert.strictEqual(r.repeated, true);
});

// ── New: STUCK (consecutive identical invocations w/o state change) ──────

test("STUCK directive after streakThreshold consecutive identical calls", () => {
  const guard = createLoopBudgetGuard({ stepBudget: 120, perToolThreshold: 10, streakThreshold: 3 });
  guard.record("toolK", { v: 1 });
  guard.record("toolK", { v: 1 });
  const r2 = guard.record("toolK", { v: 1 }); // streak = 3
  assert.strictEqual(r2.streak, 3);
  assert.strictEqual(r2.stuck, true);
  assert.strictEqual(r2.directive, "STUCK");
});

test("streak resets when key changes", () => {
  const guard = createLoopBudgetGuard({ stepBudget: 120, perToolThreshold: 10, streakThreshold: 3 });
  guard.record("toolL", { v: 1 });
  guard.record("toolL", { v: 1 });
  guard.record("toolL", { v: 1 }); // streak 3, stuck
  const r = guard.record("toolM", { v: 1 }); // different key
  assert.strictEqual(r.streak, 1);
  assert.strictEqual(r.stuck, false);
  assert.strictEqual(r.directive, null);
});

test("noteStateChange resets streak", () => {
  const guard = createLoopBudgetGuard({ stepBudget: 120, perToolThreshold: 10, streakThreshold: 3 });
  guard.record("toolN", { v: 1 });
  guard.record("toolN", { v: 1 });
  guard.record("toolN", { v: 1 }); // streak 3
  guard.noteStateChange();
  const r = guard.record("toolN", { v: 1 });
  assert.strictEqual(r.streak, 1);
  assert.strictEqual(r.stuck, false);
  assert.strictEqual(r.directive, null);
});

// ── New: ABORT (hard step cap) ────────────────────────────────────────────

test("hardStepCap reached → ABORT", () => {
  const guard = createLoopBudgetGuard({ stepBudget: 1000, hardStepCap: 3, perToolThreshold: 10 });
  guard.record("toolO", { v: 1 });
  guard.record("toolO", { v: 1 });
  guard.record("toolO", { v: 1 }); // steps = 3, hard cap reached
  const r = guard.record("toolO", { v: 1 });
  assert.strictEqual(r.hardCapReached, true);
  assert.strictEqual(r.directive, "ABORT");
});

test("ABORT takes precedence over STOP_CHECKPOINT", () => {
  const guard = createLoopBudgetGuard({ stepBudget: 2, hardStepCap: 2, perToolThreshold: 10 });
  guard.record("toolP", { v: 1 });
  guard.record("toolP", { v: 1 }); // steps=2, hard cap reached
  const r = guard.record("toolP", { v: 1 });
  assert.strictEqual(r.directive, "ABORT");
});

test("STUCK takes precedence over CHECKPOINT/ESCALATE", () => {
  const guard = createLoopBudgetGuard({ stepBudget: 120, perToolThreshold: 2, streakThreshold: 2 });
  guard.record("toolQ", { v: 1 });
  guard.record("toolQ", { v: 1 }); // count=2 → would be CHECKPOINT, but streak=2 → STUCK
  const r = guard.record("toolQ", { v: 1 });
  assert.strictEqual(r.directive, "STUCK");
});

test("snapshot preserves streak state", () => {
  const guard = createLoopBudgetGuard({ stepBudget: 120, perToolThreshold: 10, streakThreshold: 5 });
  guard.record("toolR", { v: 1 });
  guard.record("toolR", { v: 1 });
  const snap = guard.snapshot();
  assert.strictEqual(snap.lastKey, "toolR:{\"v\":1}");
  assert.strictEqual(snap.streak, 2);
  const restored = createLoopBudgetGuard({ stepBudget: 120, perToolThreshold: 10, streakThreshold: 5 });
  restored.restore(snap);
  const r = restored.record("toolR", { v: 1 });
  assert.strictEqual(r.streak, 3);
});
