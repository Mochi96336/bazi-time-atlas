import test from "node:test";
import assert from "node:assert/strict";
import {
  EQUATION_OF_TIME_GRID_CONTINUITY_CONTRACT,
  continuousResidualEnvelopeFromGrid,
  maximumCertifiedLipschitzForContinuousCap,
  uniformGridSampleCover,
  year4006SwissGridContinuityReadiness
} from "../src/recurrence/equation-of-time-grid-continuity-bound.js";

const OBSERVED_4006_MAX_SECONDS = 1.4929317113205443;
const FIVE_MINUTES_SECONDS = 300;
const COMMON_YEAR_SECONDS = 365 * 86400;
const DENSE_4006_SAMPLES = 105120;

test("year-4006 Swiss grid remains uncertified without a global residual Lipschitz proof", () => {
  const result = year4006SwissGridContinuityReadiness();
  assert.equal(result.targetYear, 4006);
  assert.equal(result.evidenceId, "swiss-ephemeris-eot-4006-dense-v2");
  assert.equal(result.cadenceMinutes, 5);
  assert.equal(result.samples, DENSE_4006_SAMPLES);
  assert.equal(result.observedMaxAbsErrorSeconds, OBSERVED_4006_MAX_SECONDS);
  assert.equal(result.domainDurationSeconds, COMMON_YEAR_SECONDS);
  assert.equal(result.terminalEndpointSampled, false);
  assert.equal(result.sampleCoverRadiusSeconds, FIVE_MINUTES_SECONDS);
  assert.equal(result.certifiedResidualLipschitzAvailable, false);
  assert.deepEqual(result.missingProof, ["certified-global-residual-lipschitz-bound"]);
  assert.equal(result.status, "missing-certified-residual-lipschitz-bound");
  assert.equal(result.continuousUpperBound, false);
  assert.equal(result.continuousUpperBoundSeconds, null);
  assert.equal(result.deterministicMembership, false);
  assert.equal(result.recurrenceAuthorityGranted, false);
});

test("uniform grid without the terminal endpoint has full-cadence cover radius, not half cadence", () => {
  const result = uniformGridSampleCover({
    domainDurationSeconds:COMMON_YEAR_SECONDS,
    cadenceSeconds:FIVE_MINUTES_SECONDS,
    sampleCount:DENSE_4006_SAMPLES,
    terminalEndpointSampled:false
  });
  assert.equal(result.sampleCoverRadiusSeconds, 300);
  assert.equal(result.completeUniformGrid, true);
});

test("sampling the terminal endpoint reduces a complete uniform grid cover radius to half cadence", () => {
  const result = uniformGridSampleCover({
    domainDurationSeconds:COMMON_YEAR_SECONDS,
    cadenceSeconds:FIVE_MINUTES_SECONDS,
    sampleCount:DENSE_4006_SAMPLES + 1,
    terminalEndpointSampled:true
  });
  assert.equal(result.sampleCoverRadiusSeconds, 150);
});

test("discrete maximum alone cannot produce a continuous envelope", () => {
  const result = continuousResidualEnvelopeFromGrid({
    observedMaxAbsErrorSeconds:OBSERVED_4006_MAX_SECONDS,
    sampleCoverRadiusSeconds:300
  });
  assert.equal(result.status, "missing-certified-residual-lipschitz-bound");
  assert.equal(result.continuousUpperBound, false);
  assert.equal(result.continuousUpperBoundSeconds, null);
  assert.equal(result.certifiedResidualLipschitzSecondsPerSecond, null);
});

test("a certified global residual Lipschitz bound lifts the grid maximum by L times cover radius", () => {
  const result = continuousResidualEnvelopeFromGrid({
    observedMaxAbsErrorSeconds:OBSERVED_4006_MAX_SECONDS,
    sampleCoverRadiusSeconds:300,
    certifiedResidualLipschitzSecondsPerSecond:0.001,
    certificationMethod:"interval-derivative-proof-v1"
  });
  assert.equal(result.status, "continuous-upper-bound-derived");
  assert.equal(result.interpolationAllowanceSeconds, 0.3);
  assert.equal(result.continuousUpperBoundSeconds, OBSERVED_4006_MAX_SECONDS + 0.3);
  assert.equal(result.continuousUpperBound, true);
  assert.equal(result.deterministicMembership, false);
  assert.equal(result.recurrenceAuthorityGranted, false);
});

test("two-second research cap exposes the exact derivative proof threshold without calling it certified", () => {
  const result = maximumCertifiedLipschitzForContinuousCap({
    observedMaxAbsErrorSeconds:OBSERVED_4006_MAX_SECONDS,
    sampleCoverRadiusSeconds:300,
    continuousCapSeconds:2
  });
  assert.equal(result.possible, true);
  assert.ok(Math.abs(result.maximumLipschitzSecondsPerSecond - 0.0016902276289315192) < 1e-15);
  assert.ok(Math.abs(result.maximumLipschitzSecondsPerDay - 146.03566713968326) < 1e-10);
});

test("a requested continuous cap below an already observed grid residual is impossible", () => {
  const result = maximumCertifiedLipschitzForContinuousCap({
    observedMaxAbsErrorSeconds:OBSERVED_4006_MAX_SECONDS,
    sampleCoverRadiusSeconds:300,
    continuousCapSeconds:1
  });
  assert.equal(result.possible, false);
  assert.equal(result.maximumLipschitzSecondsPerSecond, null);
  assert.equal(result.maximumLipschitzSecondsPerDay, null);
});

test("grid geometry and certified derivative inputs fail closed when malformed", () => {
  assert.throws(
    () => uniformGridSampleCover({
      domainDurationSeconds:COMMON_YEAR_SECONDS,
      cadenceSeconds:300,
      sampleCount:DENSE_4006_SAMPLES - 1
    }),
    /sampleCount mismatch/
  );
  assert.throws(
    () => uniformGridSampleCover({
      domainDurationSeconds:1000,
      cadenceSeconds:300,
      sampleCount:3
    }),
    /integer multiple/
  );
  assert.throws(
    () => continuousResidualEnvelopeFromGrid({
      observedMaxAbsErrorSeconds:OBSERVED_4006_MAX_SECONDS,
      sampleCoverRadiusSeconds:300,
      certifiedResidualLipschitzSecondsPerSecond:-1,
      certificationMethod:"forged"
    }),
    /finite non-negative/
  );
  assert.throws(
    () => continuousResidualEnvelopeFromGrid({
      observedMaxAbsErrorSeconds:OBSERVED_4006_MAX_SECONDS,
      sampleCoverRadiusSeconds:300,
      certifiedResidualLipschitzSecondsPerSecond:0.001,
      certificationMethod:""
    }),
    /certificationMethod/
  );
});

test("continuity contract forbids promoting sampling density or finite differences into certification", () => {
  const contract = EQUATION_OF_TIME_GRID_CONTINUITY_CONTRACT;
  assert.equal(contract.discreteGridAloneIsContinuousBound, false);
  assert.equal(contract.denserSamplingAloneIsCertification, false);
  assert.equal(contract.observedFiniteDifferenceAloneIsCertification, false);
  assert.equal(contract.certifiedResidualLipschitzRequired, true);
  assert.equal(
    contract.boundFormula,
    "max_grid_abs_residual + certified_lipschitz * sample_cover_radius"
  );
  assert.equal(contract.unsampledTerminalEndpointUsesFullCadenceCoverRadius, true);
  assert.equal(contract.continuousBoundAloneGrantsDeterministicMembership, false);
  assert.equal(contract.continuousBoundAloneGrantsRecurrenceAuthority, false);
});
