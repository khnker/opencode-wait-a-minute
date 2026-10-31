import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { classifyDesignTask, loadDesignContext, loadDesignTokens, initDesignMarkdown, setDesignToken, detectDesignDrift } from "./design-context.js";
import { assembleContext } from "./assembly.js";

test("T1 — backend-only task loads zero design tokens", async () => {
  const pack = await assembleContext({
    prompt: "Migrate PostgreSQL users table to add email index",
    taskId: "t-backend",
    budget: 8000,
  });
  const text = pack.lines.join("\n");
  assert.equal(text.includes("[wam design budget]"), false);
});

test("T2 — token modification loads tokens", async () => {
  const root = process.cwd();
  initDesignMarkdown(root);
  const pack = await assembleContext({
    prompt: "make buttons more rounded",
    taskId: "t-token",
    budget: 8000,
    projectPath: root,
  });
  const text = pack.lines.join("\n");
  assert.ok(text.includes("[wam design budget]"));
});

test("T3 — DESIGN.md semantic token selected", () => {
  const root = process.cwd();
  initDesignMarkdown(root);
  const tokens = loadDesignTokens(root);
  assert.equal(tokens["color.action.primary"], "#2563EB");
});

test("T4 — init design markdown template", () => {
  const root = process.cwd();
  const designPath = path.join(root, "DESIGN.md");
  if (fs.existsSync(designPath)) fs.unlinkSync(designPath);
  const created = initDesignMarkdown(root);
  assert.equal(created, true);
  assert.equal(fs.existsSync(designPath), true);
});

test("T5 — set design token", () => {
  const root = process.cwd();
  setDesignToken(root, "color.action.primary", "#123456");
  const tokens = loadDesignTokens(root);
  assert.equal(tokens["color.action.primary"], "#123456");
});

test("T6 — classify design task categories", () => {
  const cat = classifyDesignTask("create the dashboard page");
  assert.ok(cat);
});

test("T7 — design context non-UI zero overhead", async () => {
  const pack = await assembleContext({
    prompt: "refactor api client service",
    taskId: "t-nonui",
    budget: 5000,
  });
  assert.equal(pack.lines.some(l => l.includes("[wam design]")), false);
});

test("T8 — cards-only skill prompt is not a design task", async () => {
  initDesignMarkdown(process.cwd());
  const prompt = "skills base: cards ≤400 chars, suggest skills context";
  assert.equal(classifyDesignTask(prompt), null);
  const pack = await assembleContext({ prompt, taskId: "t-cards-only", budget: 8000 });
  const text = pack.lines.join("\n");
  assert.equal(text.includes("[wam design context]"), false);
  assert.equal(text.includes("[wam design budget]"), false);
});

test("T9 — real UI prompt still emits design context", async () => {
  initDesignMarkdown(process.cwd());
  const pack = await assembleContext({ prompt: "create the dashboard page", taskId: "t-ui", budget: 8000 });
  const text = pack.lines.join("\n");
  assert.equal(text.includes("[wam design context]"), true);
  assert.equal(text.includes("[wam design budget]"), true);
});
