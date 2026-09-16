import test from "node:test";
import assert from "node:assert/strict";
import {
  FORWARD_SLOPE_CONTINUITY_CONTRACT,
  continuousDerivativeBoundFromForwardSlopeGrid,
  maximumCertifiedSecondDerivativeForDerivativeCap
} from "../src/recurrence/forward-slope-continuity-bound.js";

const SWISS_OBSERVED_MAX_FORWARD_SOLAR_SECONDS_PER_DAY = 26.555449898870393;
const SOLAR_SECONDS_PER_DEGREE = 240;
const SWISS_OBSERVED_MAX_FORWARD_DEGREES_PER_DAY =
  SWISS_OBSERVED_MAX_FORWARD_SOLAR_SECONDS_PER_DAY / SOLAR_SECONDS_PER_DEGREE;
const FIVE_MINUTES_SECONDS = 300;
const SWISS_CONTINUOUS_DERIVATIVE_BUDGET_SOLAR_SECONDS_PER_DAY = 114.00594286480292;
const SWISS_CONTINUOUS_DERIVATIVE_BUDGET_DEGREES_PER_DAY =
  SWISS_CONTINUOUS_DERIVATIVE_BUDGET_SOLAR_SECONDS_PER_DAY / SOLAR_SECONDS_PER_DEGREE;

test("forward slope grid alone cannot become a pointwise continuous derivative bound", () => {
  const result = continuousDerivativeBoundFromForwardSlopeGrid({
    observedMaxAbsForwardSlopePerDay:SWISS_OBSERVED_MAX_FORWARD_DEGREES_PER_DAY,
    intervalWidthSeconds:FIVE_MINUTES_SECONDS
  });
  assert.equal(result.status, "missing-certified-second-derivative-bound");
  assert.equal(result.continuousDerivativeUpperBound, false);
  assert.equal(result.continuousDerivativeUpperBoundPerDay, null);
  assert.equal(result.certifiedSecondDerivativeBoundPerDaySquared, null);
  assert.equal(result.deterministicMembership, false);
  assert.equal(result.recurrenceAuthorityGranted, false);
});

test("certified second derivative lifts forward slopes using the full interval width", () => {
  const result = continuousDerivativeBoundFromForwardSlopeGrid({
    observedMaxAbsForwardSlopePerDay:0.1,
    intervalWidthSeconds:300,
    certifiedSecondDerivativeBoundPerDaySquared:100,
    certificationMethod:"interval-second-derivative-proof-v1"
  });
  assert.equal(result.status, "continuous-derivative-upper-bound-derived");
  assert.equal(result.intervalWidthDays, 300 / 86400);
  assert.equal(result.interpolationAllowancePerDay, 100 * (300 / 86400));
  assert.equal(result.continuousDerivativeUpperBoundPerDay, 0.1 + 100 * (300 / 86400));
  assert.equal(result.continuousDerivativeUpperBound, true);
});

test("year-4006 Swiss planning numbers expose the exact required second-derivative threshold", () => {
  const result = maximumCertifiedSecondDerivativeForDerivativeCap({
    observedMaxAbsForwardSlopePerDay:SWISS_OBSERVED_MAX_FORWARD_DEGREES_PER_DAY,
    intervalWidthSeconds:FIVE_MINUTES_SECONDS,
    continuousDerivativeCapPerDay:SWISS_CONTINUOUS_DERIVATIVE_BUDGET_DEGREES_PER_DAY
  });
  assert.equal(result.possible, true);
  assert.ok(
    Math.abs(result.maximumSecondDerivativePerDaySquared - 104.94059155911904) < 1e-12
  );
});

test("a target derivative cap below an already observed forward slope is impossible", () => {
  const result = maximumCertifiedSecondDerivativeForDerivativeCap({
    observedMaxAbsForwardSlopePerDay:1,
    intervalWidthSeconds:300,
    continuousDerivativeCapPerDay:0.5
  });
  assert.equal(result.possible, false);
  assert.equal(result.maximumSecondDerivativePerDaySquared, null);
});

test("malformed certified second-derivative inputs fail closed", () => {
  assert.throws(
    () => continuousDerivativeBoundFromForwardSlopeGrid({
      observedMaxAbsForwardSlopePerDay:0.1,
      intervalWidthSeconds:300,
      certifiedSecondDerivativeBoundPerDaySquared:-1,
      certificationMethod:"forged"
    }),
    /finite non-negative/
  );
  assert.throws(
    () => continuousDerivativeBoundFromForwardSlopeGrid({
      observedMaxAbsForwardSlopePerDay:0.1,
      intervalWidthSeconds:300,
      certifiedSecondDerivativeBoundPerDaySquared:1,
      certificationMethod:""
    }),
    /certificationMethod/
  );
});

test("continuity theorem contract forbids promoting finite differences into certification", () => {
  const contract = FORWARD_SLOPE_CONTINUITY_CONTRACT;
  assert.equal(contract.theorem, "mean-value-theorem-plus-certified-second-derivative");
  assert.equal(contract.forwardSlopeGridAloneIsPointwiseDerivativeBound, false);
  assert.equal(contract.observedSecondDifferencesAloneAreCertification, false);
  assert.equal(contract.certifiedGlobalSecondDerivativeBoundRequired, true);
  assert.equal(contract.usesFullIntervalWidthBecauseMeanValuePointLocationIsUnknown, true);
  assert.equal(
    contract.boundFormula,
    "max_abs_forward_slope + certified_second_derivative_bound * interval_width"
  );
  assert.equal(contract.continuousDerivativeBoundAloneGrantsDeterministicMembership, false);
  assert.equal(contract.continuousDerivativeBoundAloneGrantsRecurrenceAuthority, false);
});
