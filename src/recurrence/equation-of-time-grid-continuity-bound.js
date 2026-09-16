import { EQUATION_OF_TIME_4006_SWISS_EVIDENCE } from "../astronomy/equation-of-time-4006-swiss-evidence.js";

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_DAY = 86400;
const DAYS_PER_COMMON_YEAR = 365;
const TARGET_YEAR = 4006;

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
 * Return the worst-case distance from any point in a uniformly sampled domain
 * to its nearest retained sample.
 *
 * A common off-by-two mistake is to assume cadence / 2 even when the terminal
 * domain endpoint was not sampled. For a half-open full-year sweep containing
 * t=0, cadence, ..., duration-cadence, points approaching the terminal endpoint
 * can be almost one full cadence away from the last retained sample. The
 * correct cover radius is therefore `cadence`, not `cadence / 2`.
 */
export function uniformGridSampleCover({
  domainDurationSeconds,
  cadenceSeconds,
  sampleCount,
  terminalEndpointSampled = false
}) {
  assertFinitePositive("domainDurationSeconds", domainDurationSeconds);
  assertFinitePositive("cadenceSeconds", cadenceSeconds);
  if (!Number.isInteger(sampleCount) || sampleCount <= 0) {
    throw new RangeError("sampleCount must be a positive integer");
  }
  if (typeof terminalEndpointSampled !== "boolean") {
    throw new TypeError("terminalEndpointSampled must be boolean");
  }

  const intervalCount = domainDurationSeconds / cadenceSeconds;
  if (!Number.isInteger(intervalCount)) {
    throw new RangeError("domainDurationSeconds must be an integer multiple of cadenceSeconds");
  }
  const expectedSamples = intervalCount + (terminalEndpointSampled ? 1 : 0);
  if (sampleCount !== expectedSamples) {
    throw new RangeError(
      `uniform grid sampleCount mismatch: expected ${expectedSamples}, got ${sampleCount}`
    );
  }

  return Object.freeze({
    method:"uniform-grid-nearest-sample-cover-v1",
    domainDurationSeconds,
    cadenceSeconds,
    sampleCount,
    terminalEndpointSampled,
    sampleCoverRadiusSeconds:terminalEndpointSampled ? cadenceSeconds / 2 : cadenceSeconds,
    completeUniformGrid:true
  });
}

/**
 * Lift a discrete maximum residual into a continuous upper bound only when a
 * certified global Lipschitz bound for the residual is supplied.
 *
 * If |r'(t)| <= L everywhere and every point in the domain is within R seconds
 * of a retained sample, then
 *
 *   sup |r(t)| <= max_grid |r| + L * R.
 *
 * Numerical finite differences, denser sampling, or an observed maximum slope
 * are not a certificate for L and must not be passed as certified evidence.
 */
export function continuousResidualEnvelopeFromGrid({
  observedMaxAbsErrorSeconds,
  sampleCoverRadiusSeconds,
  certifiedResidualLipschitzSecondsPerSecond = null,
  certificationMethod = null
}) {
  assertFiniteNonNegative("observedMaxAbsErrorSeconds", observedMaxAbsErrorSeconds);
  assertFiniteNonNegative("sampleCoverRadiusSeconds", sampleCoverRadiusSeconds);

  if (certifiedResidualLipschitzSecondsPerSecond === null) {
    return Object.freeze({
      method:"grid-plus-certified-residual-lipschitz-v1",
      status:"missing-certified-residual-lipschitz-bound",
      observedMaxAbsErrorSeconds,
      sampleCoverRadiusSeconds,
      certifiedResidualLipschitzSecondsPerSecond:null,
      certificationMethod:null,
      interpolationAllowanceSeconds:null,
      continuousUpperBoundSeconds:null,
      continuousUpperBound:false,
      deterministicMembership:false,
      recurrenceAuthorityGranted:false
    });
  }

  assertFiniteNonNegative(
    "certifiedResidualLipschitzSecondsPerSecond",
    certifiedResidualLipschitzSecondsPerSecond
  );
  if (typeof certificationMethod !== "string" || certificationMethod.trim() === "") {
    throw new TypeError("certificationMethod is required for a certified residual Lipschitz bound");
  }

  const interpolationAllowanceSeconds =
    certifiedResidualLipschitzSecondsPerSecond * sampleCoverRadiusSeconds;
  const continuousUpperBoundSeconds = observedMaxAbsErrorSeconds + interpolationAllowanceSeconds;

  return Object.freeze({
    method:"grid-plus-certified-residual-lipschitz-v1",
    status:"continuous-upper-bound-derived",
    observedMaxAbsErrorSeconds,
    sampleCoverRadiusSeconds,
    certifiedResidualLipschitzSecondsPerSecond,
    certificationMethod:certificationMethod.trim(),
    interpolationAllowanceSeconds,
    continuousUpperBoundSeconds,
    continuousUpperBound:true,
    deterministicMembership:false,
    recurrenceAuthorityGranted:false
  });
}

export function maximumCertifiedLipschitzForContinuousCap({
  observedMaxAbsErrorSeconds,
  sampleCoverRadiusSeconds,
  continuousCapSeconds
}) {
  assertFiniteNonNegative("observedMaxAbsErrorSeconds", observedMaxAbsErrorSeconds);
  assertFinitePositive("sampleCoverRadiusSeconds", sampleCoverRadiusSeconds);
  assertFiniteNonNegative("continuousCapSeconds", continuousCapSeconds);

  if (continuousCapSeconds < observedMaxAbsErrorSeconds) {
    return Object.freeze({
      possible:false,
      observedMaxAbsErrorSeconds,
      sampleCoverRadiusSeconds,
      continuousCapSeconds,
      maximumLipschitzSecondsPerSecond:null,
      maximumLipschitzSecondsPerDay:null
    });
  }

  const maximumLipschitzSecondsPerSecond =
    (continuousCapSeconds - observedMaxAbsErrorSeconds) / sampleCoverRadiusSeconds;
  return Object.freeze({
    possible:true,
    observedMaxAbsErrorSeconds,
    sampleCoverRadiusSeconds,
    continuousCapSeconds,
    maximumLipschitzSecondsPerSecond,
    maximumLipschitzSecondsPerDay:maximumLipschitzSecondsPerSecond * SECONDS_PER_DAY
  });
}

/**
 * Describe exactly what the corrected year-4006 Swiss grid can prove today.
 * The dense sweep begins at 4006-01-01 00:00 and retains one sample every five
 * minutes through 4006-12-31 23:55; the next-year endpoint is not retained.
 */
export function year4006SwissGridContinuityReadiness() {
  const dense = EQUATION_OF_TIME_4006_SWISS_EVIDENCE.target4006.dense;
  const cadenceSeconds = dense.cadenceMinutes * SECONDS_PER_MINUTE;
  const domainDurationSeconds = DAYS_PER_COMMON_YEAR * SECONDS_PER_DAY;
  const cover = uniformGridSampleCover({
    domainDurationSeconds,
    cadenceSeconds,
    sampleCount:dense.samples,
    terminalEndpointSampled:false
  });
  const envelope = continuousResidualEnvelopeFromGrid({
    observedMaxAbsErrorSeconds:dense.productionErrorSeconds.maxAbs,
    sampleCoverRadiusSeconds:cover.sampleCoverRadiusSeconds
  });

  return Object.freeze({
    method:"year-4006-swiss-grid-continuity-readiness-v1",
    targetYear:TARGET_YEAR,
    evidenceId:EQUATION_OF_TIME_4006_SWISS_EVIDENCE.id,
    cadenceMinutes:dense.cadenceMinutes,
    samples:dense.samples,
    observedMaxAbsErrorSeconds:dense.productionErrorSeconds.maxAbs,
    domainDurationSeconds,
    terminalEndpointSampled:false,
    sampleCoverRadiusSeconds:cover.sampleCoverRadiusSeconds,
    completeUniformGrid:cover.completeUniformGrid,
    certifiedResidualLipschitzAvailable:false,
    missingProof:Object.freeze(["certified-global-residual-lipschitz-bound"]),
    status:envelope.status,
    continuousUpperBound:false,
    continuousUpperBoundSeconds:null,
    deterministicMembership:false,
    recurrenceAuthorityGranted:false,
    note:"The corrected 5-minute Swiss sweep supplies the discrete maximum and exact grid geometry. It still lacks a certified global bound on the time derivative of the production-minus-Swiss residual, so no continuous residual envelope is claimed."
  });
}

export const EQUATION_OF_TIME_GRID_CONTINUITY_CONTRACT = Object.freeze({
  id:"equation-of-time-grid-continuity-bound-v1",
  discreteGridAloneIsContinuousBound:false,
  denserSamplingAloneIsCertification:false,
  observedFiniteDifferenceAloneIsCertification:false,
  certifiedResidualLipschitzRequired:true,
  boundFormula:"max_grid_abs_residual + certified_lipschitz * sample_cover_radius",
  unsampledTerminalEndpointUsesFullCadenceCoverRadius:true,
  continuousBoundAloneGrantsDeterministicMembership:false,
  continuousBoundAloneGrantsRecurrenceAuthority:false
});
