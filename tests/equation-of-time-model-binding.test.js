import test from "node:test";
import assert from "node:assert/strict";
import {
  EQUATION_OF_TIME_MODEL_BINDING_CONTRACT,
  EQUATION_OF_TIME_MODEL_ID,
  UNBOUND_EQUATION_OF_TIME_MODEL,
  equationOfTimeModelBinding
} from "../src/recurrence/equation-of-time-model-binding.js";

const MODEL_ID = EQUATION_OF_TIME_MODEL_ID.ATLAS_TYME_NREL_SPA_V1;

test("Equation of Time model is explicitly unbound by default", () => {
  const result = equationOfTimeModelBinding();
  assert.equal(result, UNBOUND_EQUATION_OF_TIME_MODEL);
  assert.equal(result.bound, false);
  assert.equal(result.validatedForTarget, false);
  assert.equal(result.targetYear, null);
  assert.equal(result.authoritySource, "registry");
});

test("canonical production EoT engine binds implementation and pinned modern evidence", () => {
  const result = equationOfTimeModelBinding(MODEL_ID, 2024);
  assert.equal(result.bound, true);
  assert.equal(result.modelId, MODEL_ID);
  assert.equal(result.implementation, "src/astronomy/equation-of-time.js");
  assert.equal(result.method, "tyme-apparent-sun+nrel-spa-a1");
  assert.equal(result.evidenceId, "nrel-spa-a5+usno-modern-differential-v1");
  assert.deepEqual(result.referenceYears, [2003, 2005, 2024]);
  assert.equal(result.validationScope, "modern-reference-only");
});

test("modern reference evidence does not silently become recurrence authority", () => {
  for (const year of [2003, 2005, 2024, 4006]) {
    const result = equationOfTimeModelBinding(MODEL_ID, year);
    assert.equal(result.recurrenceAuthority, false);
    assert.deepEqual(result.recurrenceValidatedYearRanges, []);
    assert.equal(result.coversTarget, false);
    assert.equal(result.validatedForTarget, false);
    assert.equal(result.usableForRecurrence, false);
  }
});

test("a bound model without target year cannot claim target validation", () => {
  const result = equationOfTimeModelBinding(MODEL_ID);
  assert.equal(result.bound, true);
  assert.equal(result.targetYear, null);
  assert.equal(result.coversTarget, false);
  assert.equal(result.validatedForTarget, false);
});

test("legacy booleans, arbitrary objects, and unknown ids cannot forge EoT authority", () => {
  assert.throws(() => equationOfTimeModelBinding(true, 2024), /canonical non-empty string/);
  assert.throws(
    () => equationOfTimeModelBinding({
      modelId:"forged",
      evidenceId:"forged-evidence",
      validatedCoverage:{ minYear:-9999, maxYear:9999 }
    }, 4006),
    /canonical non-empty string/
  );
  assert.throws(() => equationOfTimeModelBinding("forged-model", 4006), /must be one of/);
});

test("invalid target years fail closed", () => {
  assert.throws(() => equationOfTimeModelBinding(MODEL_ID, 2024.5), /targetYear/);
  assert.throws(() => equationOfTimeModelBinding(MODEL_ID, Number.NaN), /targetYear/);
});

test("contract makes registry ownership and evidence boundaries explicit", () => {
  assert.equal(EQUATION_OF_TIME_MODEL_BINDING_CONTRACT.authorityOwnedByRegistry, true);
  assert.equal(EQUATION_OF_TIME_MODEL_BINDING_CONTRACT.callersCannotDeclareEvidence, true);
  assert.equal(EQUATION_OF_TIME_MODEL_BINDING_CONTRACT.callersCannotDeclareValidatedCoverage, true);
  assert.equal(EQUATION_OF_TIME_MODEL_BINDING_CONTRACT.rejectsBooleanPresenceClaims, true);
  assert.equal(EQUATION_OF_TIME_MODEL_BINDING_CONTRACT.finiteOutputAloneIsNotValidation, true);
  assert.equal(EQUATION_OF_TIME_MODEL_BINDING_CONTRACT.modelPresenceDoesNotImplyRecurrenceAuthority, true);
});
