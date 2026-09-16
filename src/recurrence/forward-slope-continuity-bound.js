const SECONDS_PER_DAY = 86400;

function assertFiniteNonNegative(name, value) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number`);
  }
}

function assertFinitePositive(name, value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number`);
  }
}

/**
 * Lift a complete uniform grid of forward slopes into a pointwise continuous
 * derivative bound only when a certified global second-derivative bound is
 * supplied.
 *
 * For each interval [t_i, t_{i+1}], the mean value theorem guarantees some
 * c_i in the interval with f'(c_i) equal to the interval forward slope. If
 * |f''(t)| <= M everywhere on the interval, then every x in that same interval
 * is at most one full interval width h from c_i, so
 *
 *   |f'(x)| <= |forward_slope_i| + M * h.
 *
 * The full interval width is required here. Unlike nearest retained sample
 * coverage, c_i is not known to sit at the interval midpoint, so h / 2 would
 * be unjustified.
 */
export function continuousDerivativeBoundFromForwardSlopeGrid({
  observedMaxAbsForwardSlopePerDay,
  intervalWidthSeconds,
  certifiedSecondDerivativeBoundPerDaySquared = null,
  certificationMethod = null
}) {
  assertFiniteNonNegative(
    "observedMaxAbsForwardSlopePerDay",
    observedMaxAbsForwardSlopePerDay
  );
  assertFinitePositive("intervalWidthSeconds", intervalWidthSeconds);

  const intervalWidthDays = intervalWidthSeconds / SECONDS_PER_DAY;

  if (certifiedSecondDerivativeBoundPerDaySquared === null) {
    return Object.freeze({
      method:"forward-slope-plus-certified-second-derivative-v1",
      status:"missing-certified-second-derivative-bound",
      observedMaxAbsForwardSlopePerDay,
      intervalWidthSeconds,
      intervalWidthDays,
      certifiedSecondDerivativeBoundPerDaySquared:null,
      certificationMethod:null,
      interpolationAllowancePerDay:null,
      continuousDerivativeUpperBoundPerDay:null,
      continuousDerivativeUpperBound:false,
      deterministicMembership:false,
      recurrenceAuthorityGranted:false
    });
  }

  assertFiniteNonNegative(
    "certifiedSecondDerivativeBoundPerDaySquared",
    certifiedSecondDerivativeBoundPerDaySquared
  );
  if (typeof certificationMethod !== "string" || certificationMethod.trim() === "") {
    throw new TypeError("certificationMethod is required for a certified second-derivative bound");
  }

  const interpolationAllowancePerDay =
    certifiedSecondDerivativeBoundPerDaySquared * intervalWidthDays;
  const continuousDerivativeUpperBoundPerDay =
    observedMaxAbsForwardSlopePerDay + interpolationAllowancePerDay;

  return Object.freeze({
    method:"forward-slope-plus-certified-second-derivative-v1",
    status:"continuous-derivative-upper-bound-derived",
    observedMaxAbsForwardSlopePerDay,
    intervalWidthSeconds,
    intervalWidthDays,
    certifiedSecondDerivativeBoundPerDaySquared,
    certificationMethod:certificationMethod.trim(),
    interpolationAllowancePerDay,
    continuousDerivativeUpperBoundPerDay,
    continuousDerivativeUpperBound:true,
    deterministicMembership:false,
    recurrenceAuthorityGranted:false
  });
}

/**
 * Given a desired continuous derivative cap, report the loosest certified
 * second-derivative bound that could still close the mean-value-theorem bridge.
 * This is a planning threshold only; it does not certify that second derivative.
 */
export function maximumCertifiedSecondDerivativeForDerivativeCap({
  observedMaxAbsForwardSlopePerDay,
  intervalWidthSeconds,
  continuousDerivativeCapPerDay
}) {
  assertFiniteNonNegative(
    "observedMaxAbsForwardSlopePerDay",
    observedMaxAbsForwardSlopePerDay
  );
  assertFinitePositive("intervalWidthSeconds", intervalWidthSeconds);
  assertFiniteNonNegative("continuousDerivativeCapPerDay", continuousDerivativeCapPerDay);

  if (continuousDerivativeCapPerDay < observedMaxAbsForwardSlopePerDay) {
    return Object.freeze({
      possible:false,
      observedMaxAbsForwardSlopePerDay,
      intervalWidthSeconds,
      continuousDerivativeCapPerDay,
      maximumSecondDerivativePerDaySquared:null
    });
  }

  const intervalWidthDays = intervalWidthSeconds / SECONDS_PER_DAY;
  const maximumSecondDerivativePerDaySquared =
    (continuousDerivativeCapPerDay - observedMaxAbsForwardSlopePerDay) / intervalWidthDays;

  return Object.freeze({
    possible:true,
    observedMaxAbsForwardSlopePerDay,
    intervalWidthSeconds,
    intervalWidthDays,
    continuousDerivativeCapPerDay,
    maximumSecondDerivativePerDaySquared
  });
}

export const FORWARD_SLOPE_CONTINUITY_CONTRACT = Object.freeze({
  id:"forward-slope-continuity-bound-v1",
  theorem:"mean-value-theorem-plus-certified-second-derivative",
  forwardSlopeGridAloneIsPointwiseDerivativeBound:false,
  observedSecondDifferencesAloneAreCertification:false,
  certifiedGlobalSecondDerivativeBoundRequired:true,
  usesFullIntervalWidthBecauseMeanValuePointLocationIsUnknown:true,
  boundFormula:"max_abs_forward_slope + certified_second_derivative_bound * interval_width",
  continuousDerivativeBoundAloneGrantsDeterministicMembership:false,
  continuousDerivativeBoundAloneGrantsRecurrenceAuthority:false
});
