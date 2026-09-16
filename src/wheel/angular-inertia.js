export const ANGULAR_INERTIA_DEFAULTS = Object.freeze({
  sampleWindowMs: 100,
  maxSampleAgeMs: 50,
  launchSpeedDegPerMs: 0.025,
  stopSpeedDegPerMs: 0.005,
  timeConstantMs: 220,
  maxTravelDegrees: 30,
  maxFrameGapMs: 120
});

function positiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be a positive finite number`);
  return value;
}

export function createAngularVelocityEstimator({
  windowMs = ANGULAR_INERTIA_DEFAULTS.sampleWindowMs
} = {}) {
  positiveFinite(windowMs, "windowMs");
  let samples = [];
  let cumulativeDegrees = 0;

  function reset(timeMs = null) {
    samples = [];
    cumulativeDegrees = 0;
    if (Number.isFinite(timeMs)) samples.push({ timeMs, degrees: 0 });
  }

  function add(deltaDegrees, timeMs) {
    if (!Number.isFinite(deltaDegrees)) throw new RangeError("deltaDegrees must be finite");
    if (!Number.isFinite(timeMs)) return false;

    const last = samples.at(-1);
    if (last && timeMs < last.timeMs) return false;

    cumulativeDegrees += deltaDegrees;
    if (last && timeMs === last.timeMs) {
      last.degrees = cumulativeDegrees;
      return true;
    }

    samples.push({ timeMs, degrees: cumulativeDegrees });
    const cutoff = timeMs - windowMs;
    while (samples.length > 2 && samples[1].timeMs < cutoff) samples.shift();
    return true;
  }

  function velocityAt(timeMs, {
    maxSampleAgeMs = ANGULAR_INERTIA_DEFAULTS.maxSampleAgeMs
  } = {}) {
    positiveFinite(maxSampleAgeMs, "maxSampleAgeMs");
    const last = samples.at(-1);
    if (!last || !Number.isFinite(timeMs) || timeMs - last.timeMs > maxSampleAgeMs || timeMs < last.timeMs) return 0;
    if (samples.length < 2) return 0;

    let weightSum = 0;
    let weightedTime = 0;
    let weightedDegrees = 0;
    for (const sample of samples) {
      const age = Math.max(0, last.timeMs - sample.timeMs);
      const recency = Math.max(0, Math.min(1, 1 - age / windowMs));
      const weight = 1 + recency;
      const relativeTime = sample.timeMs - last.timeMs;
      weightSum += weight;
      weightedTime += weight * relativeTime;
      weightedDegrees += weight * sample.degrees;
    }

    const meanTime = weightedTime / weightSum;
    const meanDegrees = weightedDegrees / weightSum;
    let covariance = 0;
    let variance = 0;
    for (const sample of samples) {
      const age = Math.max(0, last.timeMs - sample.timeMs);
      const recency = Math.max(0, Math.min(1, 1 - age / windowMs));
      const weight = 1 + recency;
      const dt = sample.timeMs - last.timeMs - meanTime;
      covariance += weight * dt * (sample.degrees - meanDegrees);
      variance += weight * dt * dt;
    }
    return variance > 0 ? covariance / variance : 0;
  }

  return Object.freeze({ reset, add, velocityAt });
}

export function stepAngularInertia({
  velocityDegPerMs,
  deltaTimeMs,
  timeConstantMs = ANGULAR_INERTIA_DEFAULTS.timeConstantMs
}) {
  if (!Number.isFinite(velocityDegPerMs)) throw new RangeError("velocityDegPerMs must be finite");
  if (!Number.isFinite(deltaTimeMs) || deltaTimeMs < 0) throw new RangeError("deltaTimeMs must be finite and non-negative");
  positiveFinite(timeConstantMs, "timeConstantMs");

  const decay = Math.exp(-deltaTimeMs / timeConstantMs);
  return Object.freeze({
    deltaDegrees: velocityDegPerMs * timeConstantMs * (1 - decay),
    velocityDegPerMs: velocityDegPerMs * decay
  });
}

export function shouldLaunchAngularInertia(
  velocityDegPerMs,
  {
    launchSpeedDegPerMs = ANGULAR_INERTIA_DEFAULTS.launchSpeedDegPerMs,
    reducedMotion = false
  } = {}
) {
  if (!Number.isFinite(velocityDegPerMs)) return false;
  positiveFinite(launchSpeedDegPerMs, "launchSpeedDegPerMs");
  return !reducedMotion && Math.abs(velocityDegPerMs) >= launchSpeedDegPerMs;
}
