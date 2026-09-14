const COMPONENTS_PER_STATE = 6;
const POSITION_COMPONENTS = 3;

function assertFinite(name, value) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function freezeState(state) {
  return Object.freeze({
    positionAu:Object.freeze(state.positionAu),
    velocityAuPerDay:Object.freeze(state.velocityAuPerDay)
  });
}

function sampleState(flatSeries, index) {
  const offset = index * COMPONENTS_PER_STATE;
  return {
    positionAu:[
      flatSeries[offset],
      flatSeries[offset + 1],
      flatSeries[offset + 2]
    ],
    velocityAuPerDay:[
      flatSeries[offset + 3],
      flatSeries[offset + 4],
      flatSeries[offset + 5]
    ]
  };
}

function hermiteState(flatSeries, leftIndex, fraction, stepDays) {
  const left = sampleState(flatSeries, leftIndex);
  if (fraction === 0) return freezeState(left);
  const right = sampleState(flatSeries, leftIndex + 1);
  const u = fraction;
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  const dh00 = 6 * u2 - 6 * u;
  const dh10 = 3 * u2 - 4 * u + 1;
  const dh01 = -6 * u2 + 6 * u;
  const dh11 = 3 * u2 - 2 * u;

  const positionAu = [];
  const velocityAuPerDay = [];
  for (let component = 0; component < POSITION_COMPONENTS; component += 1) {
    const p0 = left.positionAu[component];
    const p1 = right.positionAu[component];
    const v0 = left.velocityAuPerDay[component];
    const v1 = right.velocityAuPerDay[component];
    positionAu.push(
      h00 * p0
      + h10 * stepDays * v0
      + h01 * p1
      + h11 * stepDays * v1
    );
    velocityAuPerDay.push(
      (dh00 * p0
        + dh10 * stepDays * v0
        + dh01 * p1
        + dh11 * stepDays * v1) / stepDays
    );
  }
  return freezeState({ positionAu, velocityAuPerDay });
}

function validateWindow(window, index) {
  if (!window || typeof window !== "object") throw new TypeError(`state window ${index} is required`);
  assertFinite(`state window ${index}.startTdbJulianDay`, window.startTdbJulianDay);
  assertFinite(`state window ${index}.stepDays`, window.stepDays);
  if (!(window.stepDays > 0)) throw new RangeError(`state window ${index}.stepDays must be > 0`);
  if (!Number.isInteger(window.sampleCount) || window.sampleCount < 2) {
    throw new RangeError(`state window ${index}.sampleCount must be an integer >= 2`);
  }
  const expectedLength = window.sampleCount * COMPONENTS_PER_STATE;
  for (const body of ["earth", "sun"]) {
    if (!Array.isArray(window[body]) || window[body].length !== expectedLength
      || window[body].some(value => !Number.isFinite(value))) {
      throw new TypeError(`state window ${index}.${body} must contain ${expectedLength} finite components`);
    }
  }
  return Object.freeze({
    ...window,
    earth:Object.freeze([...window.earth]),
    sun:Object.freeze([...window.sun]),
    endTdbJulianDay:window.startTdbJulianDay + window.stepDays * (window.sampleCount - 1)
  });
}

function findWindow(windows, tdbJulianDay) {
  const epsilon = 1e-10;
  const matches = windows.filter(window =>
    tdbJulianDay >= window.startTdbJulianDay - epsilon
    && tdbJulianDay <= window.endTdbJulianDay + epsilon
  );
  if (!matches.length) return null;
  if (matches.length > 1) throw new RangeError(`TDB Julian Day ${tdbJulianDay} matches overlapping proof windows`);
  return matches[0];
}

/**
 * Offline DE441 interpolation proof adapter.
 *
 * The adapter owns only interpolation on already-pinned ICRF/TDB barycentric
 * state windows. It deliberately requires an external TT→TDB conversion and
 * is not registered in the production seasonal-epoch pipeline.
 */
export function createDe441StateSegmentProofAdapter({
  id = "jpl-de441-pinned-state-segment-proof",
  windows,
  provenance,
  ttToTdbJulianDay
}) {
  if (!Array.isArray(windows) || !windows.length) throw new TypeError("at least one state window is required");
  if (!provenance || provenance.sourceEphemeris !== "DE441") {
    throw new TypeError("DE441 provenance is required");
  }
  if (provenance.referenceFrame !== "ICRF" || provenance.timeScale !== "TDB") {
    throw new TypeError("proof provenance must declare ICRF/TDB state semantics");
  }
  if (typeof ttToTdbJulianDay !== "function") {
    throw new TypeError("ttToTdbJulianDay conversion is required");
  }

  const pinnedWindows = Object.freeze(windows.map(validateWindow));
  return Object.freeze({
    id,
    providerId:"jpl-de441",
    referenceFrame:"ICRF",
    ephemerisTimeScale:"TDB",
    implementation:"pinned-state-window-cubic-hermite-proof",
    proofOnly:true,
    productionIntegrated:false,
    sourceEphemeris:"DE441",
    provenance,
    windows:pinnedWindows,
    ttToEphemerisJulianDay(ttJulianDay) {
      assertFinite("ttJulianDay", ttJulianDay);
      const tdbJulianDay = ttToTdbJulianDay(ttJulianDay);
      assertFinite("TDB Julian Day", tdbJulianDay);
      return tdbJulianDay;
    },
    stateAtEphemerisJulianDay(tdbJulianDay) {
      assertFinite("tdbJulianDay", tdbJulianDay);
      const window = findWindow(pinnedWindows, tdbJulianDay);
      if (!window) throw new RangeError(`TDB Julian Day ${tdbJulianDay} is outside pinned DE441 proof windows`);
      const clamped = Math.min(window.endTdbJulianDay,
        Math.max(window.startTdbJulianDay, tdbJulianDay));
      const offset = (clamped - window.startTdbJulianDay) / window.stepDays;
      let leftIndex = Math.floor(offset);
      let fraction = offset - leftIndex;
      if (leftIndex >= window.sampleCount - 1) {
        leftIndex = window.sampleCount - 1;
        fraction = 0;
        return Object.freeze({
          earth:freezeState(sampleState(window.earth, leftIndex)),
          sun:freezeState(sampleState(window.sun, leftIndex))
        });
      }
      return Object.freeze({
        earth:hermiteState(window.earth, leftIndex, fraction, window.stepDays),
        sun:hermiteState(window.sun, leftIndex, fraction, window.stepDays)
      });
    }
  });
}
