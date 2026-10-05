import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { sanitizeShellArg, sanitizePath, stripControlChars } from "./l1-sanitize.js";
import { ResourceGuard } from "./l2-resource-guards.js";
import { checkStateInvariant } from "./l3-invariant-checker.js";
import { runInSandbox } from "./l4-containment.js";

describe("Runtime Guard - L1 Sanitize", () => {
  test("sanitizeShellArg escapes single quotes", () => {
    assert.equal(sanitizeShellArg("foo'bar"), "'foo'\\''bar'");
  });
  test("sanitizePath resolves path", () => {
    assert.ok(sanitizePath(".").startsWith("/"));
  });
  test("stripControlChars removes null", () => {
    assert.equal(stripControlChars("a\0b"), "ab");
  });
  test("stripControlChars removes bell", () => {
    assert.equal(stripControlChars("a\x07b"), "ab");
  });
  test("stripControlChars removes escape", () => {
    assert.equal(stripControlChars("a\x1Bb"), "ab");
  });
});

describe("Runtime Guard - L2 Resource", () => {
  test("ResourceGuard times out", async () => {
    const guard = new ResourceGuard({ maxDuration: 10 });
    await assert.rejects(guard.runWithTimeout(() => new Promise(resolve => setTimeout(resolve, 100))), /AbortError/);
  });
  test("ResourceGuard completes in time", async () => {
    const guard = new ResourceGuard({ maxDuration: 100 });
    const result = await guard.runWithTimeout(() => Promise.resolve("ok"));
    assert.equal(result, "ok");
  });
  test("ResourceGuard passes signal", async () => {
    const guard = new ResourceGuard({ maxDuration: 100 });
    await guard.runWithTimeout(async (signal) => {
      assert.ok(signal instanceof AbortSignal);
    });
  });
  test("ResourceGuard clears timeout", async () => {
    const guard = new ResourceGuard({ maxDuration: 1000 });
    await guard.runWithTimeout(() => Promise.resolve("ok"));
    // If it didn't clear, it might hang or throw
  });
  test("ResourceGuard handles custom duration", async () => {
    const guard = new ResourceGuard({ maxDuration: 50 });
    assert.equal(guard.maxDuration, 50);
  });
});

describe("Runtime Guard - L3 Invariant", () => {
  test("checkStateInvariant passes", () => {
    checkStateInvariant({ a: 1 }, (s) => s.a === 1);
  });
  test("checkStateInvariant throws", () => {
    assert.throws(() => checkStateInvariant({ a: 1 }, (s) => s.a === 2), /Invariant violation detected/);
  });
  test("checkStateInvariant handles complex", () => {
    checkStateInvariant({ a: { b: 1 } }, (s) => s.a.b === 1);
  });
  test("checkStateInvariant throws on false", () => {
    assert.throws(() => checkStateInvariant(null, (s) => !!s));
  });
  test("checkStateInvariant throws on undefined", () => {
    assert.throws(() => checkStateInvariant(undefined, (s) => !!s));
  });
});

describe("Runtime Guard - L4 Containment", () => {
  test("runInSandbox executes code", () => {
    assert.equal(runInSandbox("1 + 1"), 2);
  });
  test("runInSandbox scope", () => {
    assert.equal(runInSandbox("x + 1", { x: 1 }), 2);
  });
  test("runInSandbox prevents global access", () => {
    assert.throws(() => runInSandbox("process.exit()"), /process is not defined/);
  });
  test("runInSandbox prevents require", () => {
    assert.throws(() => runInSandbox("require('fs')"), /require is not defined/);
  });
  test("runInSandbox returns result", () => {
    assert.equal(runInSandbox("({ a: 1 }).a"), 1);
  });
});

describe("Runtime Guard - Boundary & Hostile", () => {
  test("L1 Hostile path traversal", () => {
    const p = sanitizePath("../../../etc/passwd");
    assert.ok(!p.includes(".."));
  });
  test("L1 Shell injection payload", () => {
    const cmd = sanitizeShellArg("; rm -rf /");
    assert.equal(cmd, "'; rm -rf /'");
  });
  test("L2 Loop detection (simulated)", async () => {
    // Basic loop protection by limiting duration.
    // The loop is cooperative: it runs until the guard aborts it, then exits so
    // the event loop can drain (an unkillable timer loop keeps node --test alive).
    const guard = new ResourceGuard({ maxDuration: 10 });
    await assert.rejects(
      guard.runWithTimeout(async (signal) => {
        while (!signal.aborted) {
          await new Promise(r => setTimeout(r, 1));
        }
      }),
      /AbortError/,
    );
  });
  test("L3 Invariant: Locked state", () => {
    const state = { locked: true };
    assert.throws(() => checkStateInvariant(state, (s) => !s.locked));
  });
  test("L4 Sandbox: Prototype pollution does not leak to host", () => {
    const result = runInSandbox("Object.prototype.polluted = true; ({})['polluted']");
    assert.equal(result, true); // mutation is visible inside the sandbox realm
    assert.equal({}.polluted, undefined); // ...but never escapes to the host realm
  });
});
