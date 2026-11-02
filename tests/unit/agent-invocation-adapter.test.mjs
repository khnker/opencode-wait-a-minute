import test from "node:test";
import assert from "node:assert/strict";

import {
  AGENT_INVOCATION_ERROR_CODES,
  AgentInvocationError,
  buildAgentPrompt,
  createOpenCodeV1AgentAdapter,
  parseAgentResultText,
  toolPolicyForRole,
} from "../../src/agents/invocation-adapter.js";

function requestFor(role = "ANALYST") {
  return {
    taskId: "task-1",
    invocationId: `inv-${role.toLowerCase()}`,
    role,
    objective: `Perform the ${role} pass`,
    acceptanceCriteria: [
      {
        id: "AC1",
        description: "The change is correct",
        mandatory: true,
        evidenceRequirements: { tests: ["unit test"] },
      },
    ],
    input: {
      artifacts: ["src/example.js"],
      evidence: ["ev-1"],
      constraints: ["Do not modify WAM state"],
      priorFindings: [],
    },
    expectedOutput: ["findings", "limitations"],
  };
}

function resultFor(request, overrides = {}) {
  const result = {
    taskId: request.taskId,
    invocationId: request.invocationId,
    role: request.role,
    status: "COMPLETED",
    summary: "Role completed its pass",
    findings: [],
    decisions: [],
    artifacts: [],
    evidence: [],
    openQuestions: [],
    recommendations: [],
    limitations: [],
    ...overrides,
  };
  if (request.role === "REVIEWER" && !("review" in overrides)) {
    result.review = { verdict: "ACCEPTED", findings: [], limitations: [] };
  }
  return result;
}

function responseWith(result, { fenced = false } = {}) {
  const text = JSON.stringify(result);
  return {
    data: {
      parts: [
        {
          type: "text",
          text: fenced ? `\`\`\`json\n${text}\n\`\`\`` : text,
        },
      ],
    },
  };
}

function fakeClient({ created, prompted, createError, promptError } = {}) {
  const calls = { create: [], prompt: [] };
  return {
    calls,
    session: {
      async create(args) {
        calls.create.push(args);
        if (createError) throw createError;
        return created ?? { data: { id: "ses-child" } };
      },
      async prompt(args) {
        calls.prompt.push(args);
        if (promptError) throw promptError;
        return prompted ?? responseWith(resultFor(requestFor()));
      },
    },
  };
}

test("derives read-only tool policy for Analyst, Architect and Reviewer", () => {
  for (const role of ["ANALYST", "ARCHITECT", "REVIEWER"]) {
    const tools = toolPolicyForRole(role);
    assert.equal(tools.read, true);
    assert.equal(tools.grep, true);
    assert.equal(tools.webfetch, true);
    assert.equal(tools.bash, false);
    assert.equal(tools.edit, false);
    assert.equal(tools.write, false);
    assert.equal(tools.patch, false);
    assert.equal(tools.task, false);
    assert.equal(tools.todowrite, false);
  }
});

test("derives mutating tool policy only for Builder", () => {
  const tools = toolPolicyForRole("BUILDER");
  assert.equal(tools.read, true);
  assert.equal(tools.bash, true);
  assert.equal(tools.edit, true);
  assert.equal(tools.write, true);
  assert.equal(tools.patch, true);
  assert.equal(tools.task, false);
  assert.equal(tools.todowrite, false);
});

test("rejects unknown roles when deriving tool policy", () => {
  assert.throws(() => toolPolicyForRole("VERIFIER"), /unknown role/);
});

test("builds a role prompt with objective, criteria and output shape", () => {
  const request = requestFor("BUILDER");
  const prompt = buildAgentPrompt(request);

  assert.match(prompt.system, /You are the WAM BUILDER role/);
  assert.match(prompt.system, /Do not invoke another role/);
  assert.match(prompt.system, /Do not include a `review` field/);
  assert.match(prompt.system, /"role": "BUILDER"/);
  assert.doesNotMatch(prompt.system, /"review":/);
  assert.match(prompt.text, /Objective: Perform the BUILDER pass/);
  assert.match(prompt.text, /AC1 \[mandatory\]: The change is correct/);
  assert.match(prompt.text, /evidence: \{\"tests\":\[\"unit test\"\]\}/);
});

test("reviewer prompt requires a review result", () => {
  const prompt = buildAgentPrompt(requestFor("REVIEWER"));
  assert.match(prompt.system, /Include `review` unless status is FAILED/);
  assert.match(prompt.system, /"review":/);
  assert.match(prompt.system, /"correctiveAction"/);
});

test("parses a plain JSON result", () => {
  const request = requestFor();
  const parsed = parseAgentResultText(JSON.stringify(resultFor(request)));
  assert.equal(parsed.taskId, "task-1");
});

test("parses one fenced JSON result", () => {
  const request = requestFor();
  const parsed = parseAgentResultText(
    `\`\`\`json\n${JSON.stringify(resultFor(request), null, 2)}\n\`\`\``,
  );
  assert.equal(parsed.invocationId, "inv-analyst");
});

test("rejects prose, multiple objects and invalid JSON", () => {
  for (const text of [
    "",
    "Here is the result: {}",
    '{"a":1}\n{"b":2}',
    "```json\n{}\n```\n```json\n{}\n```",
  ]) {
    assert.throws(
      () => parseAgentResultText(text),
      (error) => error instanceof AgentInvocationError &&
        error.code === AGENT_INVOCATION_ERROR_CODES.INVALID_RESULT,
    );
  }
});

test("creates a child session and sends one role prompt", async () => {
  const request = requestFor("ANALYST");
  const client = fakeClient({ prompted: responseWith(resultFor(request)) });
  const adapter = createOpenCodeV1AgentAdapter({
    client,
    directory: "/repo",
    parentSessionID: "ses-parent",
  });

  const invocation = await adapter.invoke(request);

  assert.deepEqual(invocation.metadata, { sessionID: "ses-child" });
  assert.equal(invocation.result.role, "ANALYST");
  assert.equal(client.calls.create.length, 1);
  assert.equal(client.calls.prompt.length, 1);
  assert.deepEqual(client.calls.create[0].query, { directory: "/repo" });
  assert.equal(client.calls.create[0].body.parentID, "ses-parent");
  assert.match(client.calls.create[0].body.title, /WAM ANALYST task-1 inv-analyst/);

  const body = client.calls.prompt[0].body;
  assert.equal(body.agent, undefined);
  assert.equal(body.tools.bash, false);
  assert.equal(body.tools.edit, false);
  assert.match(body.system, /WAM ANALYST/);
  assert.match(body.parts[0].text, /Perform the ANALYST pass/);
  assert.deepEqual(client.calls.prompt[0].path, { id: "ses-child" });
});

test("forwards a caller-supplied agent name", async () => {
  const request = requestFor("BUILDER");
  const client = fakeClient({ prompted: responseWith(resultFor(request)) });
  const adapter = createOpenCodeV1AgentAdapter({ client, agent: "wam-builder" });

  await adapter.invoke(request);

  assert.equal(client.calls.prompt[0].body.agent, "wam-builder");
});

test("accepts a fenced model response", async () => {
  const request = requestFor("REVIEWER");
  const client = fakeClient({
    prompted: responseWith(resultFor(request), { fenced: true }),
  });
  const adapter = createOpenCodeV1AgentAdapter({ client });

  const invocation = await adapter.invoke(request);

  assert.equal(invocation.result.review.verdict, "ACCEPTED");
});

test("rejects a result with a different invocation identity", async () => {
  const request = requestFor("ANALYST");
  const wrong = resultFor(request, { invocationId: "inv-other" });
  const client = fakeClient({ prompted: responseWith(wrong) });
  const adapter = createOpenCodeV1AgentAdapter({ client });

  await assert.rejects(
    () => adapter.invoke(request),
    (error) => error instanceof AgentInvocationError &&
      error.code === AGENT_INVOCATION_ERROR_CODES.INVALID_RESULT &&
      /invocationId/.test(error.message) &&
      error.sessionID === "ses-child",
  );
});

test("rejects an agent that declares DONE", async () => {
  const request = requestFor("ANALYST");
  const client = fakeClient({
    prompted: responseWith(resultFor(request, { status: "DONE" })),
  });
  const adapter = createOpenCodeV1AgentAdapter({ client });

  await assert.rejects(
    () => adapter.invoke(request),
    (error) => error instanceof AgentInvocationError &&
      error.code === AGENT_INVOCATION_ERROR_CODES.INVALID_RESULT,
  );
});

test("wraps session creation failures", async () => {
  const client = fakeClient({ createError: new Error("offline") });
  const adapter = createOpenCodeV1AgentAdapter({ client });

  await assert.rejects(
    () => adapter.invoke(requestFor()),
    (error) => error instanceof AgentInvocationError &&
      error.code === AGENT_INVOCATION_ERROR_CODES.SESSION_CREATE_FAILED &&
      error.cause?.message === "offline",
  );
});

test("wraps session creation error responses", async () => {
  const client = fakeClient({ created: { error: new Error("denied") } });
  const adapter = createOpenCodeV1AgentAdapter({ client });

  await assert.rejects(
    () => adapter.invoke(requestFor()),
    (error) => error instanceof AgentInvocationError &&
      error.code === AGENT_INVOCATION_ERROR_CODES.SESSION_CREATE_FAILED &&
      error.cause?.message === "denied",
  );
});

test("wraps prompt failures and includes the session id", async () => {
  const client = fakeClient({ promptError: new Error("timeout") });
  const adapter = createOpenCodeV1AgentAdapter({ client });

  await assert.rejects(
    () => adapter.invoke(requestFor()),
    (error) => error instanceof AgentInvocationError &&
      error.code === AGENT_INVOCATION_ERROR_CODES.PROMPT_FAILED &&
      error.sessionID === "ses-child" &&
      error.cause?.message === "timeout",
  );
});

test("wraps prompt error responses", async () => {
  const client = fakeClient({ prompted: { error: new Error("rate limited") } });
  const adapter = createOpenCodeV1AgentAdapter({ client });

  await assert.rejects(
    () => adapter.invoke(requestFor()),
    (error) => error instanceof AgentInvocationError &&
      error.code === AGENT_INVOCATION_ERROR_CODES.PROMPT_FAILED &&
      error.sessionID === "ses-child" &&
      error.cause?.message === "rate limited",
  );
});

test("rejects an invalid per-invocation agent override", async () => {
  const client = fakeClient();
  const adapter = createOpenCodeV1AgentAdapter({ client });

  await assert.rejects(
    () => adapter.invoke(requestFor(), { agent: "" }),
    /agent must be a non-empty string/,
  );
  assert.equal(client.calls.create.length, 0);
});

test("requires an OpenCode client with session create and prompt", () => {
  assert.throws(
    () => createOpenCodeV1AgentAdapter({ client: {} }),
    /requires client\.session\.create and client\.session\.prompt/,
  );
  assert.throws(
    () => createOpenCodeV1AgentAdapter({ client: {}, agent: "" }),
    /client\.session\.create/,
  );
});

test("rejects invalid requests before creating a session", async () => {
  const client = fakeClient();
  const adapter = createOpenCodeV1AgentAdapter({ client });

  await assert.rejects(
    () => adapter.invoke({ ...requestFor(), role: "VERIFIER" }),
    /unknown role/,
  );
  assert.equal(client.calls.create.length, 0);
});
