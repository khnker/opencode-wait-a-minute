import test from "node:test";
import assert from "node:assert/strict";

import { classifyBashMutation } from "../../src/execution/shell-mutation.js";

test("read-only commands are not mutations", () => {
  for (const command of [
    "git status",
    "git log --oneline",
    "git stash list",
    "node --test x.mjs",
    "grep -rn foo src",
    "docker logs --tail 20 app",
    "npm test",
    "npm run build",
  ]) {
    assert.equal(classifyBashMutation(command).mutating, false, command);
  }
});

test("quoted shell syntax is inert", () => {
  const sql =
    'psql -c "SELECT count(*) FROM t WHERE n >= 2 AND a||b = c AND x > 0"';
  assert.equal(classifyBashMutation(sql).mutating, false);
  assert.equal(classifyBashMutation("psql -c 'SELECT cp.id FROM t cp'").mutating, false);
  assert.equal(classifyBashMutation('echo "rm -rf x > y"').mutating, false);
});

test("real redirects are mutations", () => {
  for (const command of ["echo hi > f", "echo hi >> f", "echo hi >| f", "cmd &> f"]) {
    assert.equal(classifyBashMutation(command).mutating, true, command);
  }
});

test("harmless redirects are not mutations", () => {
  for (const command of [
    "cmd 2>/dev/null",
    "cmd 1>/dev/null",
    "cmd 2>&1",
    "cmd >&2",
    "cmd > /dev/stdout",
  ]) {
    assert.equal(classifyBashMutation(command).mutating, false, command);
  }
});

test("heredoc bodies are ignored", () => {
  assert.equal(classifyBashMutation("cat <<EOF\n> rm -rf /\nEOF").mutating, false);
  assert.equal(
    classifyBashMutation("psql <<'SQL'\nSELECT 1 WHERE n >= 2;\nSQL").mutating,
    false,
  );
});

test("mutating commands and wrappers are caught", () => {
  for (const command of [
    "rm -f f",
    "cp a b",
    "mv a b",
    "mkdir -p d",
    "chmod 600 f",
    "tee out.txt",
    "sed -i s/a/b/ f",
    "sed --in-place=.bak s/a/b/ f",
    "perl -pi -e 's/a/b/' f",
    "ruby -i -pe 'gsub(/a/, \"b\")' f",
    "git commit -m x",
    "git stash pop",
    "npm install",
    "pnpm add left-pad",
    "pip install requests",
    "cargo add serde",
    "sudo rm -f f",
    "NODE_ENV=test rm -rf dist",
  ]) {
    assert.equal(classifyBashMutation(command).mutating, true, command);
  }
});

test("mutations hidden in nested shells are caught", () => {
  assert.equal(classifyBashMutation('bash -c "rm -rf build"').mutating, true);
  assert.equal(classifyBashMutation('sh -lc "npm install"').mutating, true);
  assert.equal(classifyBashMutation('bash -c "git status"').mutating, false);
});

test("empty input is not a mutation", () => {
  assert.equal(classifyBashMutation("").mutating, false);
  assert.equal(classifyBashMutation(undefined).mutating, false);
});
