/**
 * Extensibility contracts fixture (change 2 of 5).
 *
 * Proves a brand-new capability can be registered and routed using only
 * injected metadata, without editing engine.js domain logic.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { buildRegistry, routeSkillsV2 } from "../../src/engine.js";

const NEW_CAPABILITY = {
  "fixture-capability": {
    path: "/tmp/fixture-capability",
    metadata: {
      capabilities: ["fixture-cap"],
      triggers: ["fixture"],
      keywords: ["fixturekw"],
      risk: "low",
    },
  },
};

describe("extensibility: EP1 capability registration", () => {
  it("registers an injected capability with its declared metadata", () => {
    const { registry } = buildRegistry(NEW_CAPABILITY, process.cwd());
    const entry = registry["fixture-capability"];
    assert.ok(entry, "injected capability must be registered");
    assert.equal(entry.status, "APPROVED");
    assert.deepEqual(entry.capabilities, ["fixture-cap"]);
    assert.deepEqual(entry.keywords, ["fixturekw"]);
    assert.equal(entry.risk, "low");
  });

  it("preserves builtin metadata when no override is supplied", () => {
    const { registry } = buildRegistry({ "efficient-coding": {} }, process.cwd());
    const entry = registry["efficient-coding"];
    assert.ok(entry.capabilities.includes("implementation"));
    assert.equal(entry.keywords, undefined, "no injected keywords for builtin entries");
  });

  it("does not throw for missing availableSkills", () => {
    const { registry } = buildRegistry(undefined, process.cwd());
    assert.equal(typeof registry, "object");
  });
});

describe("extensibility: EP2 routing of an injected capability", () => {
  it("routes the new capability by declared keywords without touching engine.js", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wam-ext-"));
    try {
      const { registry } = buildRegistry(NEW_CAPABILITY, tmp);
      const res = routeSkillsV2(
        "please run the fixturekw workflow",
        {},
        registry,
        "STANDARD",
        { taskId: "ext-fixture", projectRoot: tmp },
      );
      assert.ok(
        res.candidates.some((c) => c.id === "fixture-capability"),
        "new capability must become a routing candidate",
      );
      assert.ok(
        res.selected.some((s) => s.id === "fixture-capability"),
        "new capability must be selected",
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
