#!/usr/bin/env node
/**
 * E2E compatibility-matrix test.
 *
 * Drives the fail-fast logic directly from the machine-readable fixture
 * (tests/e2e/opencode/compatibility-matrix.mjs). No version is hardcoded here:
 * every expectation is derived from the fixture or from package.json at runtime.
 *
 * Run: node --test tests/e2e/opencode/compatibility-matrix.test.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  COMPATIBILITY_MATRIX,
  CompatibilityError,
  assertSupportedNode,
  assertSupportedOpenCode,
  checkCompatibility,
  parseVersion,
  satisfies,
} from "./compatibility-matrix.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));

test("fixture is machine-readable and frozen", () => {
  assert.equal(typeof COMPATIBILITY_MATRIX, "object");
  assert.ok(Object.isFrozen(COMPATIBILITY_MATRIX));
  assert.ok(Object.isFrozen(COMPATIBILITY_MATRIX.node));
  assert.ok(Object.isFrozen(COMPATIBILITY_MATRIX.opencode));
  assert.equal(typeof COMPATIBILITY_MATRIX.node.supported, "string");
});

test("fixture node range matches package.json engines (no drift, no hardcode)", () => {
  assert.equal(COMPATIBILITY_MATRIX.node.supported, pkg.engines.node);
  assert.match(COMPATIBILITY_MATRIX.node.source, /package\.json/);
});

test("current Node runtime is inside the documented supported range", () => {
  assertSupportedNode(process.versions.node);
  assert.ok(satisfies(process.versions.node, COMPATIBILITY_MATRIX.node.supported));
});

test("unsupported Node versions fail fast with a non-zero exit code", () => {
  for (const bad of ["18.0.0", "19.99.99", "v18.20.4"]) {
    assert.throws(
      () => assertSupportedNode(bad),
      (error) => {
        assert.ok(error instanceof CompatibilityError);
        assert.equal(error.kind, "node");
        assert.equal(error.exitCode, 1);
        return true;
      },
      `expected ${bad} to be rejected`,
    );
  }
});

test("supported Node versions are accepted", () => {
  for (const good of ["20.0.0", "20.11.0", "22.4.1"]) {
    assert.equal(assertSupportedNode(good), true, `expected ${good} to be accepted`);
  }
});

test("OpenCode minimum is undetermined (no single-install compatibility claim)", () => {
  assert.equal(COMPATIBILITY_MATRIX.opencode.minimum, null);
  // With no declared minimum, the gate must NOT claim compatibility: it skips.
  const result = assertSupportedOpenCode("0.0.1");
  assert.deepEqual(result, { enforced: false, ok: true, minimum: null });
});

test("OpenCode fails fast when a minimum is configured (mechanism is real)", () => {
  assert.throws(
    () => assertSupportedOpenCode("0.9.0", "1.0.0"),
    (error) => {
      assert.ok(error instanceof CompatibilityError);
      assert.equal(error.kind, "opencode");
      assert.equal(error.exitCode, 1);
      return true;
    },
  );
  const ok = assertSupportedOpenCode("1.2.0", "1.0.0");
  assert.deepEqual(ok, { enforced: true, ok: true, minimum: "1.0.0" });
});

test("checkCompatibility reports both axes and aggregates failures", () => {
  const good = checkCompatibility({ nodeVersion: "20.1.0" });
  assert.equal(good.ok, true);
  assert.equal(good.node.ok, true);
  assert.equal(good.opencode.enforced, false);

  const bad = checkCompatibility({ nodeVersion: "18.0.0" });
  assert.equal(bad.ok, false);
  assert.equal(bad.failures[0].kind, "node");

  const opencodeBad = checkCompatibility({
    nodeVersion: "20.1.0",
    opencodeVersion: "0.9.0",
    opencodeMinimum: "1.0.0",
  });
  assert.equal(opencodeBad.ok, false);
  assert.equal(opencodeBad.opencode.enforced, true);
  assert.equal(opencodeBad.failures[0].kind, "opencode");
});

test("semver helper parses and evaluates ranges deterministically", () => {
  assert.deepEqual(parseVersion("v20.11.0"), { major: 20, minor: 11, patch: 0 });
  assert.equal(satisfies("20.0.0", ">=20"), true);
  assert.equal(satisfies("19.9.9", ">=20"), false);
  assert.equal(satisfies("22.0.0", ">=20 <23"), true);
  assert.equal(satisfies("23.0.0", ">=20 <23"), false);
  assert.throws(() => satisfies("not-a-version", ">=20"), CompatibilityError);
});

test("E2E smoke test consumes the matrix instead of hardcoding versions", () => {
  const smoke = readFileSync(resolve(__dirname, "smoke.mjs"), "utf8");
  assert.match(smoke, /compatibility-matrix\.mjs/, "smoke.mjs must import the matrix");
  assert.match(smoke, /assertSupportedNode/, "smoke.mjs must enforce the matrix");
});
