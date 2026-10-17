// Test: completion gate false positives + intent detection
// Verifies the tightened completion-intent classifier doesn't trigger on
// incidental word usage while still firing on real DONE-claims.

import {
  isCompletionIntent,
  COMPLETION_INTENT_REGEX,
  evaluateCompletionGate,
} from "../src/integration/orchestration.js";

let pass = 0;
let fail = 0;
function assert(cond, label) {
  if (cond) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.error(`  FAIL  ${label}`);
  }
}

console.log("[1] isCompletionIntent — false positives (must NOT classify as DONE-claim)");
assert(!isCompletionIntent("this is a complete disaster"), "incidental: 'complete disaster'");
assert(!isCompletionIntent("the unfinished file"), "incidental: 'unfinished file'");
assert(!isCompletionIntent("could you complete the form?"), "request, not claim");
assert(!isCompletionIntent("when will it be done?"), "question, not claim");
assert(!isCompletionIntent(""), "empty string");
assert(!isCompletionIntent(null), "null");
assert(!isCompletionIntent(undefined), "undefined");
assert(!isCompletionIntent(123), "non-string");

console.log("\n[2] isCompletionIntent — real DONE-claims (must classify as DONE-claim)");
assert(isCompletionIntent("done"), "bare 'done'");
assert(isCompletionIntent("Done."), "'Done.' with punctuation");
assert(isCompletionIntent("listo"), "bare 'listo'");
assert(isCompletionIntent("I'm done"), "'I'm done'");
assert(isCompletionIntent("I am done"), "'I am done'");
assert(isCompletionIntent("I'm done"), "'I'm done'");
assert(isCompletionIntent("I am done with lunch"), "'I am done with lunch' (still a claim)");
assert(isCompletionIntent("estoy listo"), "'estoy listo'");
assert(isCompletionIntent("we are done with this"), "'we are done with this'");
assert(isCompletionIntent("Done! The task is finished."), "two sentences, second one is also claim");
assert(isCompletionIntent("finish the task"), "imperative finish");
assert(isCompletionIntent("finish it"), "imperative finish it");
assert(isCompletionIntent("complete the task"), "imperative complete");
assert(isCompletionIntent("tarea completa"), "tarea completa");
assert(isCompletionIntent("la tarea está terminada"), "tarea está terminada");
assert(isCompletionIntent("declare it done"), "declare it done");
assert(isCompletionIntent("mark complete"), "mark complete");

console.log("\n[3] evaluateCompletionGate — non-DONE prompt never returns blocked");
// State with no requirements at all → empty pending; even if some block exists,
// non-DONE prompts must short-circuit to {blocked:false}.
const emptyState = {
  requirements: [],
  contract: { status: "APPROVED", unknowns: [], assumptions: [], checks: [] },
  completionContract: { criteria: [] },
  outcomeContract: { acceptanceCriteria: [{ id: "c1" }] },
};
assert(
  evaluateCompletionGate(emptyState, "complete disaster").blocked === false,
  "gate returns not-blocked for 'complete disaster' even with empty state",
);
assert(
  evaluateCompletionGate(emptyState, "this is a complete disaster").blocked === false,
  "gate returns not-blocked for incidental 'complete disaster'",
);

console.log("\n[4] evaluateCompletionGate — real DONE-claim on incomplete state still blocks");
const pendingState = {
  requirements: [{ id: "r1", title: "do thing", status: "pending" }],
  contract: { status: "APPROVED", unknowns: [], assumptions: [], checks: [] },
  completionContract: { criteria: [] },
  outcomeContract: { acceptanceCriteria: [{ id: "c1" }] },
};
const r = evaluateCompletionGate(pendingState, "done");
assert(r.blocked === true, "real DONE-claim with pending req blocks");
assert(Array.isArray(r.pending) && r.pending.some((p) => p.includes("r1")), "pending list mentions r1");

console.log(`\nResult: ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);