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
  assert.equal(result.targetEvidenceAvailable, false);
  assert.equal(result.targetEvidence, null);
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
  assert.equal(result.targetEvidenceAvailable, true);
  assert.equal(result.targetEvidence.year, 2024);
  assert.equal(result.targetEvidence.evidenceId, "nrel-spa-a5+usno-modern-differential-v1");
  assert.equal(result.targetEvidence.evidenceKind, "modern-reference-differential");
  assert.equal(result.targetEvidence.validationScope, "modern-reference-only");
  assert.equal(result.targetEvidence.recurrenceAuthority, false);
  assert.equal(result.targetEvidenceAuthority, false);
  assert.equal(result.authorityGap, "reference-evidence-is-not-recurrence-validation");
});

test("year-4006 binding exposes corrected Swiss empirical evidence without promoting it", () => {
  const result = equationOfTimeModelBinding(MODEL_ID, 4006);
  assert.equal(result.bound, true);
  assert.equal(result.targetEvidenceAvailable, true);
  assert.equal(result.targetEvidence.year, 4006);
  assert.equal(result.targetEvidence.evidenceId, "swiss-ephemeris-eot-4006-dense-v2");
  assert.equal(result.targetEvidence.evidenceKind, "empirical-grid-observed-production-max-abs");
  assert.equal(result.targetEvidence.validationScope, "target-year-empirical-grid-only");
  assert.equal(result.targetEvidence.cadenceMinutes, 5);
  assert.equal(result.targetEvidence.samples, 105120);
  assert.equal(result.targetEvidence.observedMaxAbsErrorSeconds, 1.4929317113205443);
  assert.equal(result.targetEvidence.continuousUpperBound, false);
  assert.equal(result.targetEvidence.recurrenceAuthority, false);
  assert.equal(result.targetEvidenceAuthority, false);
  assert.equal(result.authorityGap, "empirical-grid-is-not-continuous-bound");
  assert.equal(result.validatedForTarget, false);
  assert.equal(result.usableForRecurrence, false);
});

test("years without registry-owned target evidence remain distinguishable from unvalidated evidence", () => {
  const result = equationOfTimeModelBinding(MODEL_ID, 4007);
  assert.equal(result.bound, true);
  assert.equal(result.targetEvidenceAvailable, false);
  assert.equal(result.targetEvidence, null);
  assert.equal(result.targetEvidenceAuthority, false);
  assert.equal(result.authorityGap, null);
  assert.equal(result.validatedForTarget, false);
});

test("modern and deep-time target evidence do not silently become recurrence authority", () => {
  for (const year of [2003, 2005, 2024, 4006]) {
    const result = equationOfTimeModelBinding(MODEL_ID, year);
    assert.equal(result.targetEvidenceAvailable, true);
    assert.equal(result.targetEvidenceAuthority, false);
    assert.equal(result.recurrenceAuthority, false);
    assert.deepEqual(result.recurrenceValidatedYearRanges, []);
    assert.equal(result.coversTarget, false);
    assert.equal(result.validatedForTarget, false);
    assert.equal(result.usableForRecurrence, false);
  }
});

test("a bound model without target year cannot claim target evidence or validation", () => {
  const result = equationOfTimeModelBinding(MODEL_ID);
  assert.equal(result.bound, true);
  assert.equal(result.targetYear, null);
  assert.equal(result.targetEvidenceAvailable, false);
  assert.equal(result.targetEvidence, null);
  assert.equal(result.coversTarget, false);
  assert.equal(result.validatedForTarget, false);
});

test("legacy booleans, arbitrary objects, and unknown ids cannot forge EoT authority", () => {
  assert.throws(() => equationOfTimeModelBinding(true, 2024), /canonical non-empty string/);
  assert.throws(
    () => equationOfTimeModelBinding({
      modelId:"forged",
      evidenceId:"forged-evidence",
      validatedCoverage:{ minYear:-9999, maxYear:9999 },
      targetEvidence:{ evidenceId:"forged-target-evidence", recurrenceAuthority:true }
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
  assert.equal(EQUATION_OF_TIME_MODEL_BINDING_CONTRACT.targetEvidenceMetadataOwnedByRegistry, true);
  assert.equal(EQUATION_OF_TIME_MODEL_BINDING_CONTRACT.callersCannotDeclareEvidence, true);
  assert.equal(EQUATION_OF_TIME_MODEL_BINDING_CONTRACT.callersCannotDeclareValidatedCoverage, true);
  assert.equal(EQUATION_OF_TIME_MODEL_BINDING_CONTRACT.callersCannotDeclareTargetEvidence, true);
  assert.equal(EQUATION_OF_TIME_MODEL_BINDING_CONTRACT.rejectsBooleanPresenceClaims, true);
  assert.equal(EQUATION_OF_TIME_MODEL_BINDING_CONTRACT.finiteOutputAloneIsNotValidation, true);
  assert.equal(EQUATION_OF_TIME_MODEL_BINDING_CONTRACT.targetEvidencePresenceDoesNotImplyRecurrenceAuthority, true);
  assert.equal(EQUATION_OF_TIME_MODEL_BINDING_CONTRACT.empiricalGridDoesNotImplyContinuousUpperBound, true);
  assert.equal(EQUATION_OF_TIME_MODEL_BINDING_CONTRACT.modelPresenceDoesNotImplyRecurrenceAuthority, true);
});
