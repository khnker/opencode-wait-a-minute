import { isEquivalent } from "./equivalence.mjs";

export function evaluateTask({ baseline, wam, expected = {} }) {
  const testsPassed = expected.testsPassed ?? Boolean(wam && wam.response && String(wam.response).length > 0);
  const filesExpected = expected.filesExpected ?? true;
  const equivalent = expected.expectedResponse != null 
    ? isEquivalent(wam.response, expected.expectedResponse) 
    : isEquivalent(baseline?.response, wam?.response);
  const success = Boolean(testsPassed && filesExpected && equivalent);

  return { success, equivalent, testsPassed, filesExpected };
}
