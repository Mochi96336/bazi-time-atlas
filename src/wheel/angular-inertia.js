export const ANGULAR_INERTIA_DEFAULTS = Object.freeze({
  sampleWindowMs: 100,
  maxSampleAgeMs: 50,
  launchSpeedDegPerMs: 0.025,
  stopSpeedDegPerMs: 0.0035,
  timeConstantMs: 280,
  adaptiveLowSpeedDegPerMs: 0.04,
  adaptiveHighSpeedDegPerMs: 0.15,
  adaptiveLowTimeConstantMs: 200,
  adaptiveHighTimeConstantMs: 480,
  maxTravelDegrees: 120,
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


function nonNegativeFinite(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and non-negative`);
  return value;
}

function adaptiveConfig({
  lowSpeedDegPerMs = ANGULAR_INERTIA_DEFAULTS.adaptiveLowSpeedDegPerMs,
  highSpeedDegPerMs = ANGULAR_INERTIA_DEFAULTS.adaptiveHighSpeedDegPerMs,
  lowTimeConstantMs = ANGULAR_INERTIA_DEFAULTS.adaptiveLowTimeConstantMs,
  highTimeConstantMs = ANGULAR_INERTIA_DEFAULTS.adaptiveHighTimeConstantMs
} = {}) {
  nonNegativeFinite(lowSpeedDegPerMs, "lowSpeedDegPerMs");
  positiveFinite(highSpeedDegPerMs, "highSpeedDegPerMs");
  positiveFinite(lowTimeConstantMs, "lowTimeConstantMs");
  positiveFinite(highTimeConstantMs, "highTimeConstantMs");
  if (highSpeedDegPerMs <= lowSpeedDegPerMs) {
    throw new RangeError("highSpeedDegPerMs must exceed lowSpeedDegPerMs");
  }
  if (highTimeConstantMs < lowTimeConstantMs) {
    throw new RangeError("highTimeConstantMs must be at least lowTimeConstantMs");
  }
  return {
    lowSpeedDegPerMs,
    highSpeedDegPerMs,
    lowTimeConstantMs,
    highTimeConstantMs
  };
}

function smoothstep01(value) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

export function adaptiveAngularTimeConstant(
  velocityDegPerMs,
  options = {}
) {
  if (!Number.isFinite(velocityDegPerMs)) throw new RangeError("velocityDegPerMs must be finite");
  const {
    lowSpeedDegPerMs,
    highSpeedDegPerMs,
    lowTimeConstantMs,
    highTimeConstantMs
  } = adaptiveConfig(options);
  const speed = Math.abs(velocityDegPerMs);
  if (speed <= lowSpeedDegPerMs) return lowTimeConstantMs;
  if (speed >= highSpeedDegPerMs) return highTimeConstantMs;
  const progress = (speed - lowSpeedDegPerMs) / (highSpeedDegPerMs - lowSpeedDegPerMs);
  return lowTimeConstantMs
    + (highTimeConstantMs - lowTimeConstantMs) * smoothstep01(progress);
}

function middlePolynomialCoefficients({
  lowSpeedDegPerMs,
  highSpeedDegPerMs,
  lowTimeConstantMs,
  highTimeConstantMs
}) {
  const width = highSpeedDegPerMs - lowSpeedDegPerMs;
  const deltaTimeConstant = highTimeConstantMs - lowTimeConstantMs;
  const l = lowSpeedDegPerMs;
  const invWidth = 1 / width;

  // tau(s) = lowTau + deltaTau * (3x^2 - 2x^3), x=(s-low)/width.
  // Expand to c0 + c1*s + c2*s^2 + c3*s^3 so both the time and
  // distance integrals have closed-form antiderivatives.
  const c3 = -2 * deltaTimeConstant * invWidth ** 3;
  const c2 = deltaTimeConstant * (3 * invWidth ** 2 + 6 * l * invWidth ** 3);
  const c1 = deltaTimeConstant * (-6 * l * invWidth ** 2 - 6 * l ** 2 * invWidth ** 3);
  const c0 = lowTimeConstantMs
    + deltaTimeConstant * (3 * l ** 2 * invWidth ** 2 + 2 * l ** 3 * invWidth ** 3);
  return { c0, c1, c2, c3 };
}

function middleTimePrimitive(speed, coefficients) {
  const { c0, c1, c2, c3 } = coefficients;
  return c0 * Math.log(speed)
    + c1 * speed
    + 0.5 * c2 * speed ** 2
    + (c3 / 3) * speed ** 3;
}

function middleDistancePrimitive(speed, coefficients) {
  const { c0, c1, c2, c3 } = coefficients;
  return c0 * speed
    + 0.5 * c1 * speed ** 2
    + (c2 / 3) * speed ** 3
    + 0.25 * c3 * speed ** 4;
}

function solveMiddleSpeedAfter(speed, deltaTimeMs, config, coefficients) {
  const startPrimitive = middleTimePrimitive(speed, coefficients);
  const targetPrimitive = startPrimitive - deltaTimeMs;
  let low = config.lowSpeedDegPerMs;
  let high = speed;

  // The middle-region time primitive is strictly increasing because
  // dF/ds = tau(s)/s > 0. Bisection therefore gives a stable, refresh-rate
  // independent inverse without introducing a discontinuous mode switch.
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const mid = (low + high) / 2;
    if (middleTimePrimitive(mid, coefficients) < targetPrimitive) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

export function stepAdaptiveAngularInertia({
  velocityDegPerMs,
  deltaTimeMs,
  ...options
}) {
  if (!Number.isFinite(velocityDegPerMs)) throw new RangeError("velocityDegPerMs must be finite");
  if (!Number.isFinite(deltaTimeMs) || deltaTimeMs < 0) {
    throw new RangeError("deltaTimeMs must be finite and non-negative");
  }
  if (deltaTimeMs === 0 || velocityDegPerMs === 0) {
    return Object.freeze({ deltaDegrees:0, velocityDegPerMs });
  }

  const config = adaptiveConfig(options);
  const coefficients = middlePolynomialCoefficients(config);
  const direction = Math.sign(velocityDegPerMs);
  let speed = Math.abs(velocityDegPerMs);
  let remainingMs = deltaTimeMs;
  let distance = 0;

  if (speed > config.highSpeedDegPerMs) {
    const timeToHigh = config.highTimeConstantMs
      * Math.log(speed / config.highSpeedDegPerMs);
    if (remainingMs <= timeToHigh) {
      const nextSpeed = speed * Math.exp(-remainingMs / config.highTimeConstantMs);
      distance += config.highTimeConstantMs * (speed - nextSpeed);
      return Object.freeze({
        deltaDegrees:direction * distance,
        velocityDegPerMs:direction * nextSpeed
      });
    }
    distance += config.highTimeConstantMs * (speed - config.highSpeedDegPerMs);
    remainingMs -= timeToHigh;
    speed = config.highSpeedDegPerMs;
  }

  if (speed > config.lowSpeedDegPerMs) {
    const startTimePrimitive = middleTimePrimitive(speed, coefficients);
    const lowTimePrimitive = middleTimePrimitive(config.lowSpeedDegPerMs, coefficients);
    const timeToLow = startTimePrimitive - lowTimePrimitive;
    if (remainingMs <= timeToLow) {
      const nextSpeed = solveMiddleSpeedAfter(speed, remainingMs, config, coefficients);
      distance += middleDistancePrimitive(speed, coefficients)
        - middleDistancePrimitive(nextSpeed, coefficients);
      return Object.freeze({
        deltaDegrees:direction * distance,
        velocityDegPerMs:direction * nextSpeed
      });
    }
    distance += middleDistancePrimitive(speed, coefficients)
      - middleDistancePrimitive(config.lowSpeedDegPerMs, coefficients);
    remainingMs -= timeToLow;
    speed = config.lowSpeedDegPerMs;
  }

  const nextSpeed = speed * Math.exp(-remainingMs / config.lowTimeConstantMs);
  distance += config.lowTimeConstantMs * (speed - nextSpeed);
  return Object.freeze({
    deltaDegrees:direction * distance,
    velocityDegPerMs:direction * nextSpeed
  });
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
