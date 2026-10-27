import test from "node:test";
import assert from "node:assert/strict";

import { extractContract, contractToRequirements } from "../../src/cognition/contract-extractor.js";

test("actionable prompts produce deliverables and requirements", () => {
  const contract = extractContract("implementa un endpoint OAuth2 con validación de tokens y tests");
  assert.ok(contract.objective.length > 0);
  assert.ok(contract.deliverables.length >= 1);
  const requirements = contractToRequirements(contract);
  assert.ok(requirements.length >= 1);
  assert.ok(requirements[0].startsWith("Implementa"));
});

test("prose keeps sentences, not comma fragments", () => {
  const contract = extractContract(
    "Analiza si hay mas problemas basado en los archivos de las carpetas .wam. revisa log, archivos para ver que esta fallando y como corregirlo"
  );
  const requirements = contractToRequirements(contract);
  assert.deepEqual(requirements, [
    "Analiza si hay mas problemas basado en los archivos de las carpetas .wam",
    "Revisa log, archivos para ver que esta fallando y como corregirlo",
  ]);
});

test("meta prompts produce no requirements", () => {
  const contract = extractContract("no te detengas");
  assert.equal(contract.needsClarification, true);
  assert.deepEqual(contractToRequirements(contract), []);
});
