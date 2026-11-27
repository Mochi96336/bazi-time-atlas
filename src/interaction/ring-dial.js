// Dial the instrument to another instant.
//
// Each ring turns the shortest way from its current pose to its pose at the
// target instant. It never travels through the intervening time: across months
// the hour ring would make dozens of turns and strobe. The motion follows a
// minimum-jerk curve (soft start, soft landing, no overshoot), and its length
// grows with the largest turn so a small correction stays quick.

const DIAL_MIN_MS = 650;
const DIAL_MAX_MS = 1800;
const DIAL_MS_PER_DEGREE = 5;
const DIAL_BASE_MS = 520;

export function minimumJerk(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (10 - 15 * x + 6 * x * x);
}

export function dialDurationMs(maxTurnDegrees) {
  const turn = Math.abs(Number(maxTurnDegrees) || 0);
  return Math.round(Math.min(DIAL_MAX_MS, Math.max(DIAL_MIN_MS, DIAL_BASE_MS + turn * DIAL_MS_PER_DEGREE)));
}

const mod = (value, n) => ((value % n) + n) % n;

/** The 60-state cell under the cursor for a ring rotation (state i spans i*6°…(i+1)*6°). */
export function cycleIndexAtCursor(rotation, cursorAngle, toothDegrees = 6, steps = 60) {
  return Math.floor(mod(cursorAngle - rotation, 360) / toothDegrees) % steps;
}

/** Solar longitude under the cursor for a solar-band rotation (longitude λ is drawn at angle λ). */
export function longitudeAtCursor(rotation, cursorAngle) {
  return mod(cursorAngle - rotation, 360);
}

/**
 * Rotation of every ring at progress s (0…1) of a dial from `from` to `to`
 * (both maps of ring id → rotation in degrees, already unwrapped so that
 * to − from is the shortest turn).
 */
export function dialPose(from, to, s) {
  const pose = {};
  for (const id of Object.keys(to)) pose[id] = from[id] + (to[id] - from[id]) * s;
  return pose;
}

export function largestTurn(from, to) {
  return Math.max(0, ...Object.keys(to).map(id => Math.abs(to[id] - from[id])));
}
