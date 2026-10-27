import test from "node:test";
import assert from "node:assert/strict";

import { routeSkillsV2 } from "../../src/skills/engine.js";

const registry = {
  "arch-linux-triage": {
    id: "arch-linux-triage",
    status: "APPROVED",
    name: "arch-linux-triage",
    keywords: ["arch"],
    capabilities: [],
    domain: [],
  },
  "log-reader": {
    id: "log-reader",
    status: "APPROVED",
    name: "log-reader",
    keywords: ["log"],
    capabilities: [],
    domain: [],
  },
};

test("keyword matching uses word boundaries, not substrings", () => {
  const selected = routeSkillsV2(
    "analiza los archivos y revisa el log",
    {},
    registry,
    "STANDARD"
  ).selected.map((s) => s.name);

  assert.ok(selected.includes("log-reader"));
  assert.ok(!selected.includes("arch-linux-triage"), "archivos must not match arch");
});

test("whole-word keywords still match", () => {
  const selected = routeSkillsV2("triage arch linux", {}, registry, "STANDARD").selected.map(
    (s) => s.name
  );
  assert.ok(selected.includes("arch-linux-triage"));
});

test("IDF penalizes ubiquitous keywords", () => {
  const big = {};
  for (let i = 0; i < 10; i++) {
    big[`arch-${i}`] = {
      id: `arch-${i}`,
      status: "APPROVED",
      name: `arch-${i}`,
      keywords: ["arch"],
      capabilities: [],
      domain: [],
    };
  }
  big["log-reader"] = {
    id: "log-reader",
    status: "APPROVED",
    name: "log-reader",
    keywords: ["log"],
    capabilities: [],
    domain: [],
  };
  const selected = routeSkillsV2("arch log", {}, big, "STANDARD").selected;
  const log = selected.find((s) => s.name === "log-reader");
  const arch = selected.find((s) => s.name === "arch-0");
  assert.ok(log.relevance > arch.relevance, "rare keyword must outrank ubiquitous keyword");
});

test("outcome feedback adds a small bonus", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-outcomes-"));
  fs.mkdirSync(path.join(root, ".wam", "skills"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".wam", "skills", "outcomes.json"),
    JSON.stringify({ "log-reader": { success: 3, failure: 0 } })
  );
  const selected = routeSkillsV2("log", {}, registry, "STANDARD", { projectRoot: root }).selected;
  assert.ok(selected[0].relevance > 0);
  fs.rmSync(root, { recursive: true, force: true });
});

test("skills sharing a capability are deduplicated", () => {
  const duplicateRegistry = {
    "auth-a": { id: "auth-a", status: "APPROVED", name: "auth-a", capabilities: ["auth"], keywords: [], domain: [] },
    "auth-b": { id: "auth-b", status: "APPROVED", name: "auth-b", capabilities: ["auth"], keywords: [], domain: [] },
  };
  const selected = routeSkillsV2("auth", {}, duplicateRegistry, "STANDARD").selected;
  assert.equal(selected.length, 1);
});
