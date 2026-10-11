import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enforceReadDelegation,
  DELEGATION_GATED_TOOLS,
} from "../../src/policy/governance-enforcement.js";

test("flag off (default) -> allowed for read", () => {
  const orig = process.env.WAM_READ_DELEGATION;
  delete process.env.WAM_READ_DELEGATION;
  try {
    const res = enforceReadDelegation("read", { isSubagent: false });
    assert.deepEqual(res, { allowed: true, reason: "read-delegation-off" });
  } finally {
    if (orig !== undefined) process.env.WAM_READ_DELEGATION = orig;
    else delete process.env.WAM_READ_DELEGATION;
  }
});

test("flag=enforce, main (isSubagent:false) + grep -> not allowed, reason delegate-to-fast", () => {
  const orig = process.env.WAM_READ_DELEGATION;
  process.env.WAM_READ_DELEGATION = "enforce";
  try {
    const res = enforceReadDelegation("grep", { isSubagent: false });
    assert.equal(res.allowed, false);
    assert.equal(res.reason, "delegate-to-fast");
    assert.ok(res.directive.includes("READ DELEGATION"));
  } finally {
    if (orig !== undefined) process.env.WAM_READ_DELEGATION = orig;
    else delete process.env.WAM_READ_DELEGATION;
  }
});

test("flag=enforce, subagent (isSubagent:true) + grep -> allowed", () => {
  const orig = process.env.WAM_READ_DELEGATION;
  process.env.WAM_READ_DELEGATION = "enforce";
  try {
    const res = enforceReadDelegation("grep", { isSubagent: true });
    assert.deepEqual(res, { allowed: true, reason: "subagent" });
  } finally {
    if (orig !== undefined) process.env.WAM_READ_DELEGATION = orig;
    else delete process.env.WAM_READ_DELEGATION;
  }
});

test("flag=enforce, main + write -> allowed (not delegation-gated)", () => {
  const orig = process.env.WAM_READ_DELEGATION;
  process.env.WAM_READ_DELEGATION = "enforce";
  try {
    const res = enforceReadDelegation("write", { isSubagent: false });
    assert.deepEqual(res, { allowed: true, reason: "tool-not-delegation-gated" });
  } finally {
    if (orig !== undefined) process.env.WAM_READ_DELEGATION = orig;
    else delete process.env.WAM_READ_DELEGATION;
  }
});

test("flag=warn, main + read -> allowed:false with directive", () => {
  const orig = process.env.WAM_READ_DELEGATION;
  process.env.WAM_READ_DELEGATION = "warn";
  try {
    const res = enforceReadDelegation("read", { isSubagent: false });
    assert.equal(res.allowed, false);
    assert.equal(res.reason, "delegate-to-fast");
    assert.ok(res.directive.includes("READ DELEGATION"));
  } finally {
    if (orig !== undefined) process.env.WAM_READ_DELEGATION = orig;
    else delete process.env.WAM_READ_DELEGATION;
  }
});

test("enforcementEnabled:false -> allowed", () => {
  const orig = process.env.WAM_READ_DELEGATION;
  process.env.WAM_READ_DELEGATION = "enforce";
  try {
    const res = enforceReadDelegation("read", { isSubagent: false, enforcementEnabled: false });
    assert.deepEqual(res, { allowed: true, reason: "config-disabled" });
  } finally {
    if (orig !== undefined) process.env.WAM_READ_DELEGATION = orig;
    else delete process.env.WAM_READ_DELEGATION;
  }
});
