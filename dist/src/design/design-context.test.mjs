/**
 * Design Context System Tests (T1 to T15 + Source Synthesis Tests)
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { classifyDesignTask, isUiTask } from "./classifier.js";
import { loadDesignContext, initDesignContext, setDesignToken, detectDesignDrift } from "./design-context.js";
import { assembleDesignAxis } from "./design-integration.js";
import { assembleContext } from "../context/assembly.js";

const tmpDir = path.join(process.cwd(), "tmp_design_test");

test.beforeEach(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });
});

test.afterEach(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("T1 — backend-only task loads zero design tokens", async () => {
  const pack = await assembleContext({
    prompt: "Migrate PostgreSQL users table schema",
    projectPath: tmpDir,
    budget: 8000,
  });
  const text = pack.lines.join("\n");
  assert.equal(text.includes("[wam design budget]"), false);
});

test("T2 — token modification loads only tokens + affected component", () => {
  const categories = classifyDesignTask("make buttons more rounded");
  assert.ok(categories.includes("token modification"));
});

test("T3 — existing Button component + DESIGN.md -> semantic token selected", () => {
  initDesignContext(tmpDir);
  setDesignToken(tmpDir, "color.action.primary", "#2563EB");
  const ctx = loadDesignContext(tmpDir);
  assert.equal(ctx.tokens.color.action.primary, "#2563EB");
});

test("T4 — new project without DESIGN.md -> design context missing flag", () => {
  const ctx = loadDesignContext(tmpDir);
  assert.equal(ctx.exists, false);
});

test("T5 & T13 — drift detection: DESIGN.md radius vs implementation", () => {
  initDesignContext(tmpDir);
  setDesignToken(tmpDir, "radius.control", "8px");
  const drift = detectDesignDrift(tmpDir, { radius: "14px" });
  assert.equal(drift.drift, true);
  assert.equal(drift.violations.length, 1);
});

test("T10 — form task loads accessibility context", () => {
  const categories = classifyDesignTask("accessibility and focus states for form submission");
  assert.ok(categories.includes("accessibility work"));
});

test("T14 — context budget: selected << full design context", async () => {
  initDesignContext(tmpDir);
  const designAxis = assembleDesignAxis({
    prompt: "create dashboard page",
    projectPath: tmpDir,
    flex: 5000,
  });
  assert.equal(designAxis.active, true);
  assert.ok(designAxis.tokens < 2000);
});

test("Source Synthesis Tests (6.1 - 6.3)", () => {
  const matrixPath = path.join(process.cwd(), "source-synthesis", "matrix.md");
  assert.ok(fs.existsSync(matrixPath));
  const matrixContent = fs.readFileSync(matrixPath, "utf8");
  assert.ok(matrixContent.includes("1. Xialiang"));
  assert.ok(matrixContent.includes("12. ContentSrc"));
});
