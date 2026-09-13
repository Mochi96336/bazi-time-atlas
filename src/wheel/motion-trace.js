import { pointAt } from "./polar-geometry.js";

export const MOTION_TRACE_MAX_DEGREES = 72;
export const MOTION_TRACE_MIN_DEGREES = 0.015;

export function clampMotionDelta(deltaDegrees, maxDegrees = MOTION_TRACE_MAX_DEGREES) {
  if (!Number.isFinite(deltaDegrees)) throw new RangeError("deltaDegrees must be finite");
  if (!Number.isFinite(maxDegrees) || maxDegrees <= 0) throw new RangeError("maxDegrees must be positive and finite");
  return Math.max(-maxDegrees, Math.min(maxDegrees, deltaDegrees));
}

/**
 * Draw the short path that one ring phase just travelled into the fixed read-head.
 * Positive rotation approaches the anchor clockwise; negative rotation approaches
 * it counter-clockwise. The current phase always terminates at anchorDegrees.
 */
export function signedMotionArcPath(center, radius, anchorDegrees, deltaDegrees) {
  if (![center?.x, center?.y, radius, anchorDegrees, deltaDegrees].every(Number.isFinite)) {
    throw new RangeError("motion arc geometry must be finite");
  }
  if (radius <= 0) throw new RangeError("radius must be positive");
  const delta = clampMotionDelta(deltaDegrees);
  if (Math.abs(delta) < MOTION_TRACE_MIN_DEGREES) return "";

  const previousAngle = anchorDegrees - delta;
  const start = pointAt(center, radius, previousAngle);
  const end = pointAt(center, radius, anchorDegrees);
  const span = Math.abs(delta);
  const largeArc = span > 180 ? 1 : 0;
  const sweep = delta > 0 ? 1 : 0;
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius.toFixed(3)} ${radius.toFixed(3)} 0 ${largeArc} ${sweep} ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}
