/**
 * Test script for WAM Conversational Comprehension, Pragmatic Alignment, and Stage Recognition.
 */

import { strict as assert } from "node:assert";
import { validatePragmaticAlignment } from "./src/cognition/task-inference-engine.js";

console.log("=== Running WAM Comprehension & Friction Tests ===");

// Test 1: Pragmatic Alignment normal prompt
const aligned = validatePragmaticAlignment("agrega caché para rendimiento", "Optimizing performance cache");
assert.equal(aligned, true, "Normal aligned prompt should pass");

// Test 2: Pragmatic Alignment conflicting prompt (frustration/contradiction marker)
const conflicting = validatePragmaticAlignment("no quiero eso en vez de lo anterior", "Optimizing performance cache");
assert.equal(conflicting, false, "Conflicting/frustration prompt should be detected");

console.log("SUCCESS: All WAM comprehension and friction tests passed cleanly!");
