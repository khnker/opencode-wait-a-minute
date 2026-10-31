/**
 * Regression: WAM bloqueaba herramientas legítimas por fail-closed (UNKNOWN → BLOCKED).
 *
 * Dos capas de la corrección:
 * 1. SCOPE BOUNDARY: el action-risk-envelope gobierna acciones con blast radius
 *    sobre el proyecto. Las tools de runtime/meta del agente (`compress`,
 *    `delegate_task`, `call_agent`) quedan FUERA y hacen bypass total.
 * 2. Playwright MCP: el catálogo explícito sólo cubría 23 de las ~60 tools
 *    `browser_*`; el resto caía en UNKNOWN. Se clasifican por verbo.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CAPABILITY_LEVELS,
  OUT_OF_SCOPE_TOOLS,
  getCapability,
  getEffectiveCapability,
  isMutatingCapability,
} from "../../src/policy/action-capabilities.js";
import { evaluateAction } from "../../src/policy/risk-engine.js";

describe("action-capabilities: scope boundary", () => {
  it("runtime/meta tools are out of scope and bypass fail-closed", () => {
    assert.equal(getEffectiveCapability("task"), CAPABILITY_LEVELS.SAFE);
    assert.equal(getEffectiveCapability("skill"), CAPABILITY_LEVELS.SAFE);
    for (const tool of ["compress", "delegate_task", "call_agent"]) {
      assert.equal(OUT_OF_SCOPE_TOOLS.has(tool), true, `${tool} must be out of scope`);
      assert.equal(getEffectiveCapability(tool), CAPABILITY_LEVELS.SAFE);
      assert.equal(isMutatingCapability(tool), false);
      assert.equal(evaluateAction(tool, {}, "/tmp").level, "SAFE");
    }
  });

  it("out-of-scope tools are not in the explicit catalog (intent is the boundary)", () => {
    assert.equal(getCapability("compress"), CAPABILITY_LEVELS.UNKNOWN);
    assert.equal(getCapability("delegate_task"), CAPABILITY_LEVELS.UNKNOWN);
    assert.equal(getCapability("call_agent"), CAPABILITY_LEVELS.UNKNOWN);
  });
});

describe("action-capabilities: playwright MCP verb fallback", () => {
  it("classifies by verb (prefixed and raw names)", () => {
    assert.equal(getCapability("playwright_browser_reload"), CAPABILITY_LEVELS.SAFE);
    assert.equal(getCapability("playwright_browser_mouse_click_xy"), CAPABILITY_LEVELS.GUARDED);
    assert.equal(getCapability("playwright_browser_cookie_set"), CAPABILITY_LEVELS.GUARDED);
    assert.equal(getCapability("playwright_browser_evaluate"), CAPABILITY_LEVELS.BLOCKED);
    assert.equal(getCapability("playwright_browser_run_code_unsafe"), CAPABILITY_LEVELS.BLOCKED);
    assert.equal(getCapability("browser_navigate_forward"), CAPABILITY_LEVELS.SAFE);
    assert.equal(getCapability("browser_localstorage_get"), CAPABILITY_LEVELS.SAFE);
    assert.equal(getCapability("browser_localstorage_set"), CAPABILITY_LEVELS.GUARDED);
  });
});

describe("action-capabilities: fail-closed still holds for project tools", () => {
  it("truly unknown (non-playwright) tools stay blocked", () => {
    assert.equal(getCapability("totally_unknown_tool"), CAPABILITY_LEVELS.UNKNOWN);
    assert.equal(getEffectiveCapability("totally_unknown_tool"), CAPABILITY_LEVELS.BLOCKED);
  });

  it("destructive project tools stay blocked", () => {
    assert.equal(getEffectiveCapability("rm"), CAPABILITY_LEVELS.BLOCKED);
    assert.equal(getEffectiveCapability("sudo"), CAPABILITY_LEVELS.BLOCKED);
  });
});
