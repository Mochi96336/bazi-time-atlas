import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_SWISS_EVIDENCE } from "../src/astronomy/equation-of-time-4006-swiss-evidence.js";
import {
  EQUATION_OF_TIME_MODEL_ID,
  equationOfTimeModelBinding
} from "../src/recurrence/equation-of-time-model-binding.js";

const evidence = EQUATION_OF_TIME_4006_SWISS_EVIDENCE;

test("corrected Swiss year-4006 EoT evidence pins immutable research provenance", () => {
  assert.equal(evidence.reference.authority, "Swiss Ephemeris / Astrodienst");
  assert.equal(evidence.reference.libraryVersion, "2.10.03");
  assert.equal(evidence.reference.function, "swe_time_equ(tjd_ut)");
  assert.equal(evidence.reference.deltaTFunction, "swe_deltat_ex(tjd_ut, FLG_SWIEPH)");
  assert.equal(evidence.reference.equationInputTimeScale, "UT");
  assert.equal(evidence.reference.futureUtcPolicyClaim, false);
  assert.equal(evidence.provenance.researchPullRequest, 160);
  assert.equal(evidence.provenance.researchHeadSha, "7b42c266dee8fd4971c0f8bd4e31e8f8c75626c8");
  assert.equal(evidence.provenance.workflowRunId, 35014458620);
  assert.equal(evidence.provenance.workflowRunNumber, 11);
  assert.equal(evidence.provenance.artifactId, 10414623680);
  assert.equal(evidence.provenance.artifactDigest, "sha256:b21f11f54c7b5b6ba1175743449fbe4c717b7ae3518f4bfa79660e0d9f45f086");
  assert.equal(evidence.provenance.supersedesInvalidResearchRun.workflowRunId, 35013985750);
  assert.equal(evidence.ephemerisFiles.length, 4);
  for (const file of evidence.ephemerisFiles) assert.match(file.sha256, /^[0-9a-f]{64}$/);
});

test("modern control remains sub-second on the corrected UT reference path", () => {
  assert.equal(evidence.control2026.samples, 8760);
  assert.ok(evidence.control2026.alignedErrorSeconds.maxAbs < 0.35);
  assert.ok(evidence.control2026.alignedErrorSeconds.rms < 0.23);
  assert.ok(evidence.control2026.productionDeltaTContributionToEotSeconds.maxAbs < 0.001);
});

test("corrected dense year-4006 sweep records the observed production and aligned envelopes", () => {
  const dense = evidence.target4006.dense;
  assert.equal(dense.cadenceMinutes, 5);
  assert.equal(dense.samples, 365 * 24 * 12);
  assert.ok(dense.alignedErrorSeconds.maxAbs > 1.26);
  assert.ok(dense.alignedErrorSeconds.maxAbs < 1.27);
  assert.ok(dense.productionErrorSeconds.maxAbs > 1.49);
  assert.ok(dense.productionErrorSeconds.maxAbs < 1.50);
  assert.deepEqual(
    dense.alignedErrorSeconds.worst,
    { year:4006, month:11, day:11, hour:5, minute:10, second:0 }
  );
  assert.deepEqual(
    dense.productionErrorSeconds.worst,
    { year:4006, month:10, day:10, hour:7, minute:45, second:0 }
  );
});

test("Delta-T disagreement is quantified separately from the EoT model residual", () => {
  const dense = evidence.target4006.dense;
  assert.ok(dense.deltaTSecondsDifference.maxAbs > 1600);
  assert.ok(dense.deltaTSecondsDifference.maxAbs < 1700);
  assert.ok(dense.productionDeltaTContributionToEotSeconds.maxAbs > 0.5);
  assert.ok(dense.productionDeltaTContributionToEotSeconds.maxAbs < 0.52);
  assert.ok(dense.productionErrorSeconds.maxAbs > dense.alignedErrorSeconds.maxAbs);
});

test("corrected Swiss evidence stays empirical and non-authoritative for exact Hour proof", () => {
  assert.equal(evidence.interpretation.fullYear4006Measured, true);
  assert.equal(evidence.interpretation.denseSweepIsEmpiricalNotContinuousBound, true);
  assert.equal(evidence.interpretation.recurrenceAuthorityGranted, false);
  assert.deepEqual(evidence.interpretation.recurrenceValidatedYearRanges, []);
  assert.equal(
    evidence.interpretation.observedProductionMaxAbsErrorSeconds4006,
    1.4929317113205443
  );

  const binding = equationOfTimeModelBinding(
    EQUATION_OF_TIME_MODEL_ID.ATLAS_TYME_NREL_SPA_V1,
    4006
  );
  assert.equal(binding.bound, true);
  assert.equal(binding.recurrenceAuthority, false);
  assert.equal(binding.coversTarget, false);
  assert.equal(binding.validatedForTarget, false);
  assert.equal(binding.usableForRecurrence, false);
});
