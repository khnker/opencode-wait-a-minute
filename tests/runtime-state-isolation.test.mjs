import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

function trackedWam() {
  try {
    return execFileSync("git", ["ls-files", ".wam"], { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

describe("runtime state isolation (.wam)", () => {
  it("gitignores the .wam runtime directory", () => {
    assert.match(gitignore, /^\/\.wam\/$/m, ".gitignore must ignore /.wam/");
  });

  it("tracks no runtime state under .wam", () => {
    assert.deepEqual(trackedWam(), [], ".wam must be runtime-only, never tracked");
  });

  it("does not publish .wam in the package surface", () => {
    const files = pkg.files || [];
    const mentionsWam = files.some((f) => f.replace(/^!/, "").includes(".wam"));
    assert.equal(mentionsWam, false, "package.json#files must not reference .wam");
  });
});
