import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CPC_TOKEN_BUDGET,
  CPC_INJECTION_CACHE_LIMIT,
  buildCanonicalProjectContext,
  renderCanonicalProjectContext,
  validateCanonicalProjectContext,
  prepareCanonicalProjectContext,
  injectCanonicalProjectContext,
  resetCanonicalProjectContextState,
} from "./canonical-project-context.js";
import { countTokens } from "./tokenizer.js";

const MEMO = [
  "# Project Context",
  "## Stack (observed)",
  "- Proyecto wait-a-minute-plugin (opencode-wait-a-minute)",
  "## Facts",
  "- OpenSpec es la fuente de verdad de los cambios",
  "## Inferred",
  "- El usuario escribe en español",
].join("\n");

test("verified sections become facts and assumed sections become assumptions", () => {
  const { cpc } = prepareCanonicalProjectContext({ doc: MEMO });
  assert.deepEqual(
    cpc.entries.map((e) => [e.kind, e.text]),
    [
      ["fact", "Proyecto wait-a-minute-plugin (opencode-wait-a-minute)"],
      ["fact", "OpenSpec es la fuente de verdad de los cambios"],
      ["assumption", "El usuario escribe en español"],
    ],
  );
});

test("session-scoped sections and session-marked content never enter the CPC", () => {
  const doc = [
    "# Project Context",
    "## Facts",
    "- Hecho canónico del proyecto",
    "- sessionId: abc123def456",
    "## Session Notes",
    "- se habló del refactor",
    "## Recent Changes",
    "- 2026-10-22 algo pasó",
  ].join("\n");
  const { cpc, text } = prepareCanonicalProjectContext({ doc });
  assert.ok(text.includes("Hecho canónico del proyecto"), "el hecho canónico se conserva");
  assert.ok(!text.includes("abc123def456"), "no se filtra el sessionId");
  assert.ok(!text.includes("se habló del refactor"), "no se filtra la sección de sesión");
  assert.ok(!text.includes("2026-10-22 algo pasó"), "no se filtra historial reciente");
  assert.equal(cpc.rejected.length, 3, "las tres líneas fuera de alcance se rechazan");
  assert.ok(cpc.rejected.some((r) => r.reason === "session-scoped content"));
});

test("rendered CPC stays under the token budget with an oversized memo", () => {
  const doc = [
    "# Project Context",
    "## Facts",
    ...Array.from(
      { length: 40 },
      (_, i) => `- Hecho ${i} con una descripción canónica larga de la estructura y convenciones del proyecto`,
    ),
  ].join("\n");
  const { cpc, text, tokens, valid } = prepareCanonicalProjectContext({ doc });
  assert.ok(tokens < CPC_TOKEN_BUDGET, `tokens ${tokens} < ${CPC_TOKEN_BUDGET}`);
  assert.ok(countTokens(text) < CPC_TOKEN_BUDGET);
  assert.equal(valid, true, "un CPC dentro de presupuesto es válido");
  assert.ok(cpc.truncated || cpc.dropped.length > 0, "el contenido excedente se descarta o se trunca");
});

test("assumptions are dropped before facts under budget pressure", () => {
  const doc = [
    "# Project Context",
    "## Facts",
    "- El proyecto usa OpenSpec para cada cambio",
    "## Inferred",
    ...Array.from(
      { length: 30 },
      (_, i) => `- Supuesto ${i} suficientemente largo para consumir el presupuesto disponible del bloque`,
    ),
  ].join("\n");
  const { cpc } = prepareCanonicalProjectContext({ doc });
  assert.ok(
    cpc.entries.some((e) => e.kind === "fact" && e.text.includes("OpenSpec")),
    "los hechos verificados sobreviven",
  );
  assert.ok(
    cpc.dropped.every((d) => d.kind === "assumption"),
    "solo se descartan supuestos",
  );
});

test("facts and assumptions are labeled distinctly in the rendered block", () => {
  const text = renderCanonicalProjectContext(buildCanonicalProjectContext({ doc: MEMO }));
  assert.ok(text.includes("[wam CPC fact] Proyecto wait-a-minute-plugin"));
  assert.ok(text.includes("[wam CPC assumption] El usuario escribe en español"));
  assert.ok(text.split("\n")[0].startsWith("[wam CPC]"), "el bloque se identifica como CPC");
});

test("validate flags a CPC that exceeds the token budget", () => {
  const oversized = {
    entries: [{ kind: "fact", text: "palabra ".repeat(500), section: "facts", source: "project.md" }],
  };
  const check = validateCanonicalProjectContext(oversized);
  assert.equal(check.valid, false);
  assert.ok(check.errors.some((e) => /token budget exceeded/.test(e)));
});

test("an empty memo produces no injectable block", () => {
  const { text, tokens, valid } = prepareCanonicalProjectContext({ doc: "" });
  assert.equal(text, "");
  assert.equal(tokens, 0);
  assert.equal(valid, true);
});

test("injectCanonicalProjectContext inyecta el CPC al iniciar tarea y es idempotente", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wam-cpc-"));
  try {
    fs.mkdirSync(path.join(tmp, ".wam", "context"), { recursive: true });
    fs.writeFileSync(path.join(tmp, ".wam", "context", "project.md"), MEMO, "utf-8");
    const output = { parts: [{ type: "text", text: "mensaje del usuario" }] };

    const first = injectCanonicalProjectContext(output, { root: tmp, taskId: "t-cpc", messageID: "m-1" });
    assert.equal(first.injected, true, "el CPC se inyecta al iniciar tarea");

    const injected = output.parts.filter((p) => String(p.text || "").includes("[wam CPC"));
    assert.equal(injected.length, 1, "un solo bloque CPC");
    assert.ok(countTokens(injected[0].text) < CPC_TOKEN_BUDGET, "el bloque inyectado respeta el presupuesto");
    assert.equal(injected[0].metadata?.wam, true, "la parte inyectada queda trazada como sintética de WAM");
    assert.ok(
      injected[0].text.includes("[wam CPC fact] Proyecto wait-a-minute-plugin"),
      "el contenido canónico del proyecto viaja en el bloque",
    );
    assert.ok(!/session|taskId|transcript/i.test(injected[0].text), "sin datos de sesión");

    const second = injectCanonicalProjectContext(output, { root: tmp, taskId: "t-cpc" });
    assert.equal(second.injected, false, "no se duplica el bloque");
    assert.equal(second.reason, "already injected");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("injectCanonicalProjectContext no inyecta sin tarea activa", () => {
  const output = { parts: [] };
  const result = injectCanonicalProjectContext(output, { root: process.cwd() });
  assert.equal(result.injected, false);
  assert.equal(result.reason, "no active task");
  assert.equal(output.parts.length, 0);
});

test("injectCanonicalProjectContext acota el registro de inyecciones con evicción FIFO", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wam-cpc-"));
  try {
    fs.mkdirSync(path.join(tmp, ".wam", "context"), { recursive: true });
    fs.writeFileSync(path.join(tmp, ".wam", "context", "project.md"), MEMO, "utf-8");
    resetCanonicalProjectContextState();
    for (let i = 0; i <= CPC_INJECTION_CACHE_LIMIT; i++) {
      injectCanonicalProjectContext({ parts: [] }, { root: tmp, taskId: `t-${i}` });
    }
    const oldest = injectCanonicalProjectContext({ parts: [] }, { root: tmp, taskId: "t-0" });
    assert.equal(oldest.injected, true, "la tarea más antigua fue desalojada y puede reinyectarse");
    const recent = injectCanonicalProjectContext({ parts: [] }, {
      root: tmp,
      taskId: `t-${CPC_INJECTION_CACHE_LIMIT}`,
    });
    assert.equal(recent.injected, false, "la tarea reciente sigue registrada");
    assert.equal(recent.reason, "already injected");
  } finally {
    resetCanonicalProjectContextState();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("injectCanonicalProjectContext agrega el CPC después de las partes existentes", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wam-cpc-"));
  try {
    fs.mkdirSync(path.join(tmp, ".wam", "context"), { recursive: true });
    fs.writeFileSync(path.join(tmp, ".wam", "context", "project.md"), MEMO, "utf-8");
    resetCanonicalProjectContextState();
    const output = { parts: [{ type: "text", text: "mensaje del usuario" }] };
    injectCanonicalProjectContext(output, { root: tmp, taskId: "t-order", messageID: "m-order" });
    assert.equal(output.parts.length, 2, "el CPC se agrega sin reemplazar las partes previas");
    assert.equal(output.parts[0].text, "mensaje del usuario");
    const last = output.parts.at(-1);
    assert.ok(last.text.startsWith("[wam CPC]"), "el CPC va después de las partes existentes");
    assert.equal(last.synthetic, true);
    assert.equal(last.metadata?.wam, true);
  } finally {
    resetCanonicalProjectContextState();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
