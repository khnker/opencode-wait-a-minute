import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function hasBun() {
  return spawnSync("bun", ["--version"], { encoding: "utf8" }).status === 0;
}

test("repograph provider passes the sqlite gate under bun", { skip: !hasBun() }, () => {
  const code = `
    import * as provider from "./vendor/context-query-core/src/repograph-provider.js";
    const p = provider.createDefaultProvider({
      repoRoot: process.cwd(),
      coreDir: "/tmp/wam-repograph-missing-core",
    });
    const s = await p.getStatus();
    if (String(s.reason || "").includes("sqlite")) {
      console.error(JSON.stringify(s));
      process.exit(3);
    }
    console.log("SQLITE_GATE_PASSED");
  `;
  const r = spawnSync("bun", ["-e", code], { cwd: repoRoot, encoding: "utf8", timeout: 30000 });

  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /SQLITE_GATE_PASSED/);
});
