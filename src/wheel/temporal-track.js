import { shortestAngleDelta } from "./polar-geometry.js";

const TOOTH_DEGREES = 6;

function assertIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index >= 60) {
    throw new RangeError("cycle index must be an integer from 0 to 59");
  }
}

function assertProgress(progress) {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new RangeError("phase progress must be finite from 0 to 1");
  }
}

/**
 * Position of the selected instant on a 60-state wheel.
 *
 * The old atlas aligned the centre of the active tooth to the cursor. That made
 * Hour/Day/Month/Year lookup wheels rather than time tracks. A temporal track
 * instead places the actual within-state phase under the selected-instant cursor:
 * state start = i*6°, state end = (i+1)*6°.
 */
export function temporalCycleCoordinate(index, progress) {
  assertIndex(index);
  assertProgress(progress);
  return index * TOOTH_DEGREES + progress * TOOTH_DEGREES;
}

export function temporalCycleTargetRotation(index, progress, cursorAngle) {
  if (!Number.isFinite(cursorAngle)) throw new RangeError("cursorAngle must be finite");
  return cursorAngle - temporalCycleCoordinate(index, progress);
}

/**
 * Return an equivalent rotation nearest the previous rendered rotation so the
 * 59→0 sexagenary wrap does not create a fake 360° visual jump.
 */
export function unwrapTemporalRotation(targetRotation, previousRotation = null) {
  if (!Number.isFinite(targetRotation)) throw new RangeError("targetRotation must be finite");
  if (previousRotation === null) return targetRotation;
  if (!Number.isFinite(previousRotation)) throw new RangeError("previousRotation must be finite or null");
  return previousRotation + shortestAngleDelta(targetRotation, previousRotation);
}

export function temporalCycleRotation({ index, progress, cursorAngle, previousRotation = null }) {
  const targetRotation = temporalCycleTargetRotation(index, progress, cursorAngle);
  return unwrapTemporalRotation(targetRotation, previousRotation);
}

export const TEMPORAL_TRACK_CONSTANTS = Object.freeze({ toothDegrees:TOOTH_DEGREES });
