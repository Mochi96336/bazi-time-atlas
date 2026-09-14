function assertFinite(value, name) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function assertModulus(modulus) {
  if (!Number.isFinite(modulus) || modulus <= 0) throw new RangeError("modulus must be positive");
}

export function normalizedPhase(phase, modulus) {
  assertFinite(phase, "phase");
  assertModulus(modulus);
  return ((phase % modulus) + modulus) % modulus;
}

/**
 * Return the shortest signed displacement from the shared zero reference.
 * Positive values travel toward the fan's right edge; phases beyond half a
 * cycle wrap to the equivalent negative displacement on the left.
 */
export function signedShortestPhase(phase, modulus) {
  const normalized = normalizedPhase(phase, modulus);
  const half = modulus / 2;
  return normalized > half ? normalized - modulus : normalized;
}

/** Map a cyclic phase onto a fixed fan gauge where zero always stays at referenceAngle. */
export function phaseAngleOnFan({
  phase,
  modulus,
  fanStart = -170,
  fanEnd = -10,
  referenceAngle = -90
}) {
  assertFinite(fanStart, "fanStart");
  assertFinite(fanEnd, "fanEnd");
  assertFinite(referenceAngle, "referenceAngle");
  if (!(fanStart < referenceAngle && referenceAngle < fanEnd)) {
    throw new RangeError("referenceAngle must lie inside the fan");
  }
  const signed = signedShortestPhase(phase, modulus);
  const half = modulus / 2;
  if (signed < 0) return referenceAngle + (signed / half) * (referenceAngle - fanStart);
  return referenceAngle + (signed / half) * (fanEnd - referenceAngle);
}

export function phaseFanCells({
  modulus,
  sectors,
  fanStart = -170,
  fanEnd = -10
}) {
  assertModulus(modulus);
  if (!Number.isInteger(sectors) || sectors <= 0) throw new RangeError("sectors must be a positive integer");
  if (modulus % sectors !== 0) throw new RangeError("modulus must divide evenly into sectors");
  const span = fanEnd - fanStart;
  if (!(span > 0)) throw new RangeError("fanEnd must be greater than fanStart");
  const phasePerSector = modulus / sectors;
  const anglePerSector = span / sectors;
  return Object.freeze(Array.from({ length:sectors }, (_, index) => Object.freeze({
    index,
    startAngle:fanStart + index * anglePerSector,
    endAngle:fanStart + (index + 1) * anglePerSector,
    signedStart:(index - sectors / 2) * phasePerSector,
    phasePerSector
  })));
}
