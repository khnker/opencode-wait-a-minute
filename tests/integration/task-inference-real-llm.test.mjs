import test from "node:test";
import assert from "node:assert/strict";
import { buildTaskInferenceDirective } from "../../src/cognition/task-inference-engine.js";

const BASE_URL = process.env.WAM_BENCH_BASE_URL;
const API_KEY = process.env.WAM_BENCH_API_KEY;
const MODEL = process.env.WAM_BENCH_MODEL;
const configured = Boolean(BASE_URL && API_KEY && MODEL);

test(
  "real LLM infers non-implicit tasks and completion checks",
  { skip: configured ? false : "WAM_BENCH_BASE_URL/API_KEY/MODEL not configured" },
  async () => {
    const { lines } = buildTaskInferenceDirective({
      objective: "Habilitar endpoint /health",
      requirements: [
        { title: "Habilitar endpoint /health", description: "Enable health endpoint" },
      ],
    });
    assert.ok(lines.length > 0, "directive should be non-empty");

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Number(process.env.WAM_BENCH_TIMEOUT_MS) || 120000
    );

    try {
      const resp = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0,
          max_tokens: 4000,
          messages: [
            {
              role: "system",
              content:
                "You are a senior engineer. Follow WAM's task inference directive strictly.",
            },
            {
              role: "user",
              content: `${lines.join("\n")}\n\nRespond ONLY with JSON {"inferredTasks": string[], "completionChecks": string[]}.`,
            },
          ],
        }),
        signal: controller.signal,
      });

      assert.ok(resp.ok, `HTTP ${resp.status}`);
      const data = await resp.json();
      const message = data?.choices?.[0]?.message || {};
      const content = message.content || message.reasoning_content || "";
      console.log("LLM raw response:\n" + content);

      const jsonText = content.replace(/```json/gi, "").replace(/```/g, "").trim();
      const match = jsonText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : jsonText);

      assert.ok(
        Array.isArray(parsed.inferredTasks) && parsed.inferredTasks.length > 0,
        "expected non-empty inferredTasks"
      );
      const checks = (parsed.completionChecks || []).join(" ");
      assert.match(checks, /local|servicio|health|smoke/i);
      // Each completion check should be a non-empty string
      assert.ok(parsed.completionChecks.length > 0, "should have completion checks");
      assert.ok(parsed.completionChecks.every(check => typeof check === 'string' && check.length > 0), "each completion check should be a non-empty string");
    } finally {
      clearTimeout(timeout);
    }
  }
);
