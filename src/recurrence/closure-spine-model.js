import { recurrenceState, GREGORIAN_400_YEAR_DAYS } from "./gregorian-cycle.js";
import { phaseAngleOnFan, signedShortestPhase, phaseFanCells } from "./phase-fan-geometry.js";

// An isolated geometry experiment, not a new calendar or pillar model.
// Geometry matches the native R16 160-degree fan and its touching annuli.
export const CLOSURE_BASE_DATE = Object.freeze({ year: 2026, month: 9, day: 13 });
export const CLOSURE_STEP_YEARS = 400;
export const CLOSURE_STEPS = 60;
export const CLOSURE_FAN = Object.freeze({ cx:600, cy:820, start:-170, end:-10, zero:-90 });

export const CLOSURE_RINGS = Object.freeze([
  Object.freeze({ key:"day", title:"60 日序", inner:270, outer:360, sectors:60, modulus:60 }),
  Object.freeze({ key:"year", title:"60 年序", inner:360, outer:450, sectors:60, modulus:60 }),
  Object.freeze({ key:"gregorian", title:"400 年公曆", inner:450, outer:560, sectors:40, modulus:400 })
]);

const PHASE_KEY = Object.freeze({ day:"day", year:"yearSequence", gregorian:"gregorian" });
const CLOSED_KEY = PHASE_KEY;
const mod = (a,n) => ((a % n) + n) % n;

export function closureStateForStep(step) {
  if (!Number.isInteger(step) || step < 0 || step > CLOSURE_STEPS) {
    throw new RangeError("step must be an integer from 0 to 60");
  }
  const deltaYears = step * CLOSURE_STEP_YEARS;
  const state = recurrenceState(CLOSURE_BASE_DATE, deltaYears);
  if (!state.targetValid) throw new Error("invalid source Gregorian date");

  const rings = CLOSURE_RINGS.map(spec => {
    const phase = state.phases[PHASE_KEY[spec.key]];
    const signed = signedShortestPhase(phase,spec.modulus);
    const closed = state.closed[CLOSED_KEY[spec.key]];
    return Object.freeze({
      ...spec, phase, signed, closed,
      angle:phaseAngleOnFan({
        phase, modulus:spec.modulus,
        fanStart:CLOSURE_FAN.start, fanEnd:CLOSURE_FAN.end,
        referenceAngle:CLOSURE_FAN.zero
      })
    });
  });

  // One 400-year Gregorian block has 146,097 days, not a nominal 365*400.
  const expected = Object.freeze({
    gregorian:true,
    year:step % 3 === 0,
    day:step % 20 === 0
  });
  if (state.dayDelta !== GREGORIAN_400_YEAR_DAYS * step ||
      state.phases.day !== mod(57 * step,60) ||
      rings.some(r => r.closed !== expected[r.key])) {
    throw new Error("400-year block lattice disagrees with recurrenceState");
  }
  const closedKeys = rings.filter(r => r.closed).map(r=>r.key);
  return Object.freeze({
    step, deltaYears, date:state.targetDate,
    rings:Object.freeze(rings), closedKeys:Object.freeze(closedKeys),
    allClosed:closedKeys.length===3, expected, dayDelta:state.dayDelta
  });
}

export function closureRuns(snapshot) {
  // Every connected interval is a genuinely contiguous set of zero-phase
  // annuli. Non-adjacent closures (e.g. at 8,000 years) must not be bridged.
  const runs=[];
  let pending=null;
  for (const ring of snapshot.rings) {
    if (!ring.closed) {
      if (pending) { runs.push(Object.freeze(pending));pending=null; }
      continue;
    }
    if (pending && Math.abs(pending.outer-ring.inner)<1e-9) {
      pending.outer=ring.outer;
      pending.keys.push(ring.key);
    } else {
      if (pending)runs.push(Object.freeze(pending));
      pending={inner:ring.inner,outer:ring.outer,keys:[ring.key]};
    }
  }
  if (pending)runs.push(Object.freeze(pending));
  return Object.freeze(runs.map(run=>Object.freeze({...run,keys:Object.freeze(run.keys)})));
}

export function closureCells() {
  return CLOSURE_RINGS.flatMap(ring=>phaseFanCells({
    modulus:ring.modulus,sectors:ring.sectors,
    fanStart:CLOSURE_FAN.start,fanEnd:CLOSURE_FAN.end
  }).map(cell=>Object.freeze({...cell,ring:ring.key,inner:ring.inner,outer:ring.outer})));
}

export const CLOSURE_MILESTONES = Object.freeze([0,1,3,20,60].map(step=>Object.freeze({
  step,deltaYears:step*CLOSURE_STEP_YEARS
})));

/**
 * Presentation time, NOT elapsed calendar time.
 * Every 400-year step is a discrete exact snapshot. We hold true zero
 * encounters longer so the three-step and twenty-step rhythms remain visible.
 * No interpolation, new event geometry, or calendar change is introduced.
 */
export function closurePlaybackDwellMs(snapshot) {
  if (snapshot.allClosed) return 1600;
  if (snapshot.closedKeys.includes("day")) return 1050;
  if (snapshot.closedKeys.includes("year")) return 530;
  return 170;
}
