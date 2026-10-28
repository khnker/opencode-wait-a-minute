import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadWamConfig, parseBoolean, DEFAULT_WAM_CONFIG } from "../../src/config/wam-config.js";
import { configureLogger, isLoggingEnabled } from "../../src/integration/logger.js";
import { setLoggingEnabled, wamLog } from "../../src/shared/wam-log.js";

const ENV_KEYS = [
  "WAM_SKILLS", "WAM_DISABLE_SKILLS",
  "WAM_LOGGING", "WAM_SILENT", "WAM_DISABLE_LOGGING",
  "WAM_ENFORCEMENT", "WAM_GOVERNANCE", "WAM_BYPASS",
  "WAM_DEBUG", "WAM_DISABLE_DEBUG", "WAM_LOG_LEVEL", "WAM_CONFIG",
  "WAM_AUTO_LOOP", "WAM_DISABLE_AUTO_LOOP",
  "WAM_PERMISSION_PREFLIGHT", "WAM_DISABLE_PERMISSION_PREFLIGHT",
  "WAM_CONTEXT_PROJECTION",
];
let saved = {};

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function tmpProject(configObj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-cfg-"));
  if (configObj) {
    fs.mkdirSync(path.join(dir, ".wam"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".wam", "config.json"), JSON.stringify(configObj));
  }
  return dir;
}

test("defaults are all enabled", () => {
  const cfg = loadWamConfig(tmpProject());
  assert.deepEqual(cfg, { ...DEFAULT_WAM_CONFIG });
  assert.equal(cfg.skills, true);
  assert.equal(cfg.logging, true);
  assert.equal(cfg.enforcement, true);
});

test("parseBoolean handles common tokens", () => {
  assert.equal(parseBoolean("true"), true);
  assert.equal(parseBoolean("1"), true);
  assert.equal(parseBoolean("off"), false);
  assert.equal(parseBoolean("0"), false);
  assert.equal(parseBoolean("nonsense"), undefined);
  assert.equal(parseBoolean(undefined), undefined);
});

test("WAM_SKILLS / WAM_DISABLE_SKILLS toggle skills", () => {
  process.env.WAM_SKILLS = "false";
  assert.equal(loadWamConfig(tmpProject()).skills, false);
  delete process.env.WAM_SKILLS;
  process.env.WAM_DISABLE_SKILLS = "1";
  assert.equal(loadWamConfig(tmpProject()).skills, false);
});

test("WAM_SILENT / WAM_LOGGING toggle logging", () => {
  process.env.WAM_SILENT = "1";
  assert.equal(loadWamConfig(tmpProject()).logging, false);
  delete process.env.WAM_SILENT;
  process.env.WAM_LOGGING = "false";
  assert.equal(loadWamConfig(tmpProject()).logging, false);
});

test("WAM_GOVERNANCE=off / WAM_BYPASS disable enforcement", () => {
  process.env.WAM_GOVERNANCE = "off";
  assert.equal(loadWamConfig(tmpProject()).enforcement, false);
  delete process.env.WAM_GOVERNANCE;
  process.env.WAM_BYPASS = "1";
  assert.equal(loadWamConfig(tmpProject()).enforcement, false);
});

test("config file is honored", () => {
  const cfg = loadWamConfig(tmpProject({ skills: false, logging: false, enforcement: false }));
  assert.deepEqual(cfg, { skills: false, logging: false, enforcement: false, debug: true, autoLoop: true, permissionPreflight: true, contextProjection: "active" });
});

test("contextProjection defaults to active and honors env/file overrides", () => {
  assert.equal(loadWamConfig(tmpProject()).contextProjection, "active");
  assert.equal(loadWamConfig(tmpProject({ contextProjection: "shadow" })).contextProjection, "shadow");
  process.env.WAM_CONTEXT_PROJECTION = "shadow";
  assert.equal(loadWamConfig(tmpProject({ contextProjection: "active" })).contextProjection, "shadow");
  delete process.env.WAM_CONTEXT_PROJECTION;
  // Raw file values pass through unvalidated; resolveProjectionMode falls back to active.
  assert.equal(loadWamConfig(tmpProject({ contextProjection: "bogus" })).contextProjection, "bogus");
});

test("env overrides config file", () => {
  const dir = tmpProject({ skills: false, logging: true, enforcement: true });
  process.env.WAM_SKILLS = "true";
  const cfg = loadWamConfig(dir);
  assert.equal(cfg.skills, true);
  assert.equal(cfg.logging, true);
});

test("malformed config file falls back to defaults", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-cfg-bad-"));
  fs.mkdirSync(path.join(dir, ".wam"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".wam", "config.json"), "{ not json ]");
  assert.deepEqual(loadWamConfig(dir), { ...DEFAULT_WAM_CONFIG });
});
test("debug defaults to true", () => {
  assert.equal(loadWamConfig(tmpProject()).debug, true);
});
test("WAM_DEBUG=1 / WAM_DEBUG=true enables debug", () => {
  process.env.WAM_DEBUG = "1";
  assert.equal(loadWamConfig(tmpProject()).debug, true);
  delete process.env.WAM_DEBUG;
  process.env.WAM_DEBUG = "true";
  assert.equal(loadWamConfig(tmpProject()).debug, true);
  delete process.env.WAM_DEBUG;
});
test("WAM_LOG_LEVEL=debug enables debug", () => {
  process.env.WAM_LOG_LEVEL = "debug";
  assert.equal(loadWamConfig(tmpProject()).debug, true);
  delete process.WAM_LOG_LEVEL;
});
test("WAM_DISABLE_DEBUG=1 disables debug even if config file says true", () => {
  const dir = tmpProject({ debug: true });
  process.env.WAM_DISABLE_DEBUG = "1";
  assert.equal(loadWamConfig(dir).debug, false);
  delete process.env.WAM_DISABLE_DEBUG;
});
test("config file debug=true is honored", () => {
  assert.equal(loadWamConfig(tmpProject({ debug: true })).debug, true);
});
test("env WAM_DEBUG overrides config file debug", () => {
  const dir = tmpProject({ debug: false });
  process.env.WAM_DEBUG = "true";
  assert.equal(loadWamConfig(dir).debug, true);
  delete process.env.WAM_DEBUG;
});
test("WAM_CONFIG overrides default config file location", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-cfg-override-"));
  const alt = path.join(dir, "alt-config.json");
  fs.writeFileSync(alt, JSON.stringify({ skills: false, logging: false, enforcement: false, debug: true }));
  process.env.WAM_CONFIG = alt;
  const cfg = loadWamConfig(dir);
  assert.equal(cfg.skills, false);
  assert.equal(cfg.logging, false);
  assert.equal(cfg.debug, true);
  delete process.env.WAM_CONFIG;
});
test("WAM_CONFIG pointing at missing file falls back to defaults", () => {
  process.env.WAM_CONFIG = path.join(os.tmpdir(), "does-not-exist-" + Date.now() + ".json");
  assert.deepEqual(loadWamConfig(tmpProject()), { ...DEFAULT_WAM_CONFIG });
  delete process.env.WAM_CONFIG;
});

test("configureLogger gates file logging", () => {
  configureLogger({ enabled: false });
  assert.equal(isLoggingEnabled(), false);
  configureLogger({ enabled: true });
  assert.equal(isLoggingEnabled(), true);
});

test("setLoggingEnabled gates console output", () => {
  const seen = [];
  const orig = console.log;
  console.log = (...a) => seen.push(a);
  try {
    setLoggingEnabled(false);
    wamLog("hidden");
    setLoggingEnabled(true);
    wamLog("shown");
  } finally {
    console.log = orig;
    setLoggingEnabled(true);
  }
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], ["shown"]);
});

test("autoLoop defaults to true and honors file/env overrides", () => {
  assert.equal(loadWamConfig(tmpProject()).autoLoop, true);
  assert.equal(loadWamConfig(tmpProject({ autoLoop: false })).autoLoop, false);
  process.env.WAM_AUTO_LOOP = "0";
  assert.equal(loadWamConfig(tmpProject()).autoLoop, false);
  delete process.env.WAM_AUTO_LOOP;
  process.env.WAM_DISABLE_AUTO_LOOP = "1";
  assert.equal(loadWamConfig(tmpProject()).autoLoop, false);
});

test("permissionPreflight defaults to true and honors file/env overrides", () => {
  assert.equal(loadWamConfig(tmpProject()).permissionPreflight, true);
  assert.equal(loadWamConfig(tmpProject({ permissionPreflight: false })).permissionPreflight, false);
  process.env.WAM_PERMISSION_PREFLIGHT = "0";
  assert.equal(loadWamConfig(tmpProject()).permissionPreflight, false);
  delete process.env.WAM_PERMISSION_PREFLIGHT;
  process.env.WAM_DISABLE_PERMISSION_PREFLIGHT = "1";
  assert.equal(loadWamConfig(tmpProject()).permissionPreflight, false);
});
