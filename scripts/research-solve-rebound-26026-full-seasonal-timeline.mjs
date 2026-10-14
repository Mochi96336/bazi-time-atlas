import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  MEAN_ECLIPTIC_OF_DATE_FRAME_SEMANTICS,
  solveSeasonalCrossingFromAbsoluteState
} from "../src/astronomy/absolute-state-seasonal-solver.js";
import { ttJulianDayToTdbJulianDay } from "../src/astronomy/naif-tt-tdb-time-bridge.js";
import { HORIZONS_SUN_APPARENT_DIRECTION_PROOF_MODEL } from "../src/astronomy/horizons-sun-apparent-direction-proof.js";
import { OWEN_HORIZONS_FRAME_PROOF_CONTRACT } from "../src/astronomy/owen-horizons-frame-proof-contract.js";
import { solveSolarLongitude } from "../src/astronomy/direct-seasonal-event-provider.js";

const BASE_YEAR = 2026;
const TARGET_YEAR = 26026;
const GREGORIAN_24000_DAY_SPAN = 8_765_820;
const ROOT_TOLERANCE_SECONDS = 5;
const REGRESSION_GATE_SECONDS = 5;
const probe = process.env.OWEN_FRAME_PROBE;
const statePath = process.env.STATE_PROJECTION_JSON;
const output = process.env.OUTPUT_JSON ?? "tmp/rebound-26026-full-seasonal-timeline.json";

if (!probe) throw new Error("OWEN_FRAME_PROBE is required");
if (!statePath) throw new Error("STATE_PROJECTION_JSON is required");

const TERM_BY_LONGITUDE = new Map([
  [270,"冬至"],[285,"小寒"],[300,"大寒"],[315,"立春"],[330,"雨水"],[345,"驚蟄"],
  [0,"春分"],[15,"清明"],[30,"穀雨"],[45,"立夏"],[60,"小滿"],[75,"芒種"],
  [90,"夏至"],[105,"小暑"],[120,"大暑"],[135,"立秋"],[150,"處暑"],[165,"白露"],
  [180,"秋分"],[195,"寒露"],[210,"霜降"],[225,"立冬"],[240,"小雪"],[255,"大雪"]
]);

const PINNED_571_TT = new Map([
  [315, 11226884.452435084],
  [0, 11226929.912251243],
  [180, 11227112.28924508]
]);

const CHRONOLOGICAL_LONGITUDES = Object.freeze([
  ...Array.from({length:90}, (_,i) => 270 + i),
  ...Array.from({length:270}, (_,i) => i)
]);

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function vectorToRaDec(direction) {
  const [x,y,z] = direction;
  const radius = Math.hypot(x,y,z);
  if (!(radius > 0)) throw new RangeError("direction must have non-zero magnitude");
  return {
    raDegrees:normalizeDegrees(Math.atan2(y,x) * 180 / Math.PI),
    decDegrees:Math.asin(z / radius) * 180 / Math.PI
  };
}

function eclipticVector(longitudeDegrees, latitudeDegrees) {
  const lon = longitudeDegrees * Math.PI / 180;
  const lat = latitudeDegrees * Math.PI / 180;
  const cosLat = Math.cos(lat);
  return [
    cosLat * Math.cos(lon),
    cosLat * Math.sin(lon),
    Math.sin(lat)
  ];
}

let probeCalls = 0;
function owenFrameDirection({ ttJulianDay, directionIcrf }) {
  const { raDegrees, decDegrees } = vectorToRaDec(directionIcrf);
  const eop = OWEN_HORIZONS_FRAME_PROOF_CONTRACT.eopSource;
  const run = spawnSync(probe, [
    "apparent",
    String(ttJulianDay),
    String(raDegrees),
    String(decDegrees),
    String(eop.terminalDPsiArcsec),
    String(eop.terminalDEpsArcsec)
  ], { encoding:"utf8", maxBuffer:1024 * 1024 });
  probeCalls += 1;
  if (run.status !== 0) {
    throw new Error(
      `Owen frame probe failed at TT JD ${ttJulianDay}: ${(run.stderr ?? "").trim()}`
    );
  }
  const values = run.stdout.trim().split(/\s+/).map(Number);
  if (values.length !== 3 || values.some(value => !Number.isFinite(value))) {
    throw new Error(`malformed Owen frame output: ${run.stdout}`);
  }
  return eclipticVector(values[0], values[1]);
}

function freezeState(state) {
  return Object.freeze({
    positionAu:Object.freeze([...state.positionAu]),
    velocityAuPerDay:Object.freeze([...state.velocityAuPerDay])
  });
}

function hermiteState(left, right, fraction, stepDays) {
  if (fraction === 0) return freezeState(left);
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
  for (let component = 0; component < 3; component += 1) {
    const p0 = left.positionAu[component];
    const p1 = right.positionAu[component];
    const v0 = left.velocityAuPerDay[component];
    const v1 = right.velocityAuPerDay[component];
    positionAu.push(
      h00 * p0 + h10 * stepDays * v0 + h01 * p1 + h11 * stepDays * v1
    );
    velocityAuPerDay.push(
      (dh00 * p0 + dh10 * stepDays * v0 + dh01 * p1 + dh11 * stepDays * v1) / stepDays
    );
  }
  return freezeState({ positionAu, velocityAuPerDay });
}

function makeProjectionAdapter(payload) {
  if (payload.researchOnly !== true) throw new Error("projection must remain research-only");
  if (payload.catalogueYear !== TARGET_YEAR) throw new Error("wrong projection year");
  if (payload.validation?.accepted !== true) throw new Error("continuous projection not accepted");
  if (payload.claimBoundary?.continuousCatalogueYearStateProjected !== true) {
    throw new Error("continuous state claim missing");
  }
  if (payload.claimBoundary?.asteroid343Included !== false) {
    throw new Error("full timeline expects mass-loss-only state");
  }

  const raw = payload.stateWindow;
  const samples = Object.freeze(raw.samples.map(sample => Object.freeze({
    earth:freezeState(sample.earth),
    sun:freezeState(sample.sun)
  })));
  const start = raw.startTdbJulianDay;
  const step = raw.stepDays;
  const end = raw.endTdbJulianDay;

  return Object.freeze({
    id:"rebound-ias15-gr-solar-massloss-26026-continuous-window",
    providerId:"rebound-ias15-gr-solar-massloss-projection",
    referenceFrame:"ICRF",
    ephemerisTimeScale:"TDB",
    proofOnly:true,
    productionIntegrated:false,
    ttToEphemerisJulianDay:ttJulianDayToTdbJulianDay,
    stateAtEphemerisJulianDay(tdbJulianDay) {
      const epsilon = 1e-9;
      if (tdbJulianDay < start - epsilon || tdbJulianDay > end + epsilon) {
        throw new RangeError(`TDB Julian Day ${tdbJulianDay} is outside the continuous projected window`);
      }
      const clamped = Math.min(end, Math.max(start, tdbJulianDay));
      const offset = (clamped - start) / step;
      let leftIndex = Math.floor(offset);
      const fraction = offset - leftIndex;
      if (leftIndex >= samples.length - 1) {
        leftIndex = samples.length - 1;
        return Object.freeze({
          earth:samples[leftIndex].earth,
          sun:samples[leftIndex].sun
        });
      }
      return Object.freeze({
        earth:hermiteState(samples[leftIndex].earth, samples[leftIndex + 1].earth, fraction, step),
        sun:hermiteState(samples[leftIndex].sun, samples[leftIndex + 1].sun, fraction, step)
      });
    }
  });
}

function julianDayToProlepticGregorian(jd) {
  const shifted = jd + 0.5;
  const z = Math.floor(shifted);
  const f = shifted - z;
  const alpha = Math.floor((z - 1867216.25) / 36524.25);
  const a = z + 1 + alpha - Math.floor(alpha / 4);
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const dayFloat = b - d - Math.floor(30.6001 * e) + f;
  const day = Math.floor(dayFloat);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  const hoursFromMidnight = (dayFloat - day) * 24;
  return Object.freeze({ year, month, day, hoursFromMidnight });
}

const projection = JSON.parse(readFileSync(statePath, "utf8"));
const stateAdapter = makeProjectionAdapter(projection);
const frameTransform = Object.freeze({
  id:"swiss-owen-horizons-frame-proof-26026-full-timeline",
  frameSemantics:MEAN_ECLIPTIC_OF_DATE_FRAME_SEMANTICS,
  independentlyValidatedCatalogueYears:Object.freeze([4006]),
  targetYearIndependentlyValidated:false,
  icrfDirectionToMeanEclipticOfDate:owenFrameDirection
});
const corrections = Object.freeze({
  apparentDirectionModel:HORIZONS_SUN_APPARENT_DIRECTION_PROOF_MODEL,
  lightTime:true,
  lightTimeIterations:3
});

const baselineByLongitude = new Map();
for (const longitudeDegrees of CHRONOLOGICAL_LONGITUDES) {
  baselineByLongitude.set(
    longitudeDegrees,
    solveSolarLongitude({ year:BASE_YEAR, longitudeDegrees })
  );
}

const curve = [];
let previous = null;
for (const longitudeDegrees of CHRONOLOGICAL_LONGITUDES) {
  const baseline2026 = baselineByLongitude.get(longitudeDegrees);
  const expectedGregorianClosureTtJulianDay =
    baseline2026.ttJulianDay + GREGORIAN_24000_DAY_SPAN;

  let seedTtJulianDay;
  let initialHalfBracketDays;
  let maxHalfBracketDays;
  if (!previous) {
    seedTtJulianDay = expectedGregorianClosureTtJulianDay - 12;
    initialHalfBracketDays = 4;
    maxHalfBracketDays = 12;
  } else {
    const previousBaseline = baselineByLongitude.get(previous.longitudeDegrees);
    seedTtJulianDay = previous.ttJulianDay
      + (baseline2026.ttJulianDay - previousBaseline.ttJulianDay);
    initialHalfBracketDays = 0.2;
    maxHalfBracketDays = 1.5;
  }

  const solved = solveSeasonalCrossingFromAbsoluteState({
    year:TARGET_YEAR,
    longitudeDegrees,
    seedTtJulianDay,
    initialHalfBracketDays,
    maxHalfBracketDays,
    toleranceSeconds:ROOT_TOLERANCE_SECONDS,
    stateAdapter,
    frameTransform,
    corrections
  });

  const gregorianCycleDriftDays =
    solved.ttJulianDay - expectedGregorianClosureTtJulianDay;

  const point = Object.freeze({
    longitudeDegrees,
    name:TERM_BY_LONGITUDE.get(longitudeDegrees) ?? null,
    baseline2026TtJulianDay:baseline2026.ttJulianDay,
    expectedGregorianClosureTtJulianDay,
    ttJulianDay:solved.ttJulianDay,
    prolepticGregorianTt:julianDayToProlepticGregorian(solved.ttJulianDay),
    gregorianCycleDriftDays,
    gregorianCycleDriftHours:gregorianCycleDriftDays * 24,
    rootResidualArcsec:solved.residualDegrees * 3600
  });
  curve.push(point);
  previous = point;
}

const terms = curve.filter(point => point.name !== null);
if (terms.length !== 24) throw new Error(`expected 24 named terms, got ${terms.length}`);

const regressions = [];
for (const [longitudeDegrees, pinnedTtJulianDay] of PINNED_571_TT) {
  const point = curve.find(item => item.longitudeDegrees === longitudeDegrees);
  if (!point) throw new Error(`missing regression longitude ${longitudeDegrees}`);
  regressions.push(Object.freeze({
    longitudeDegrees,
    name:point.name,
    pinned571TtJulianDay:pinnedTtJulianDay,
    observedTtJulianDay:point.ttJulianDay,
    differenceSeconds:Math.abs(point.ttJulianDay - pinnedTtJulianDay) * 86400
  }));
}
const maxRegressionSeconds = Math.max(...regressions.map(row => row.differenceSeconds));
if (!(maxRegressionSeconds <= REGRESSION_GATE_SECONDS)) {
  throw new Error(`#571 regression failed: ${maxRegressionSeconds} s`);
}

const driftValues = curve.map(point => point.gregorianCycleDriftDays);
const minDriftDays = Math.min(...driftValues);
const maxDriftDays = Math.max(...driftValues);
const maxRootResidualArcsec = Math.max(...curve.map(point => point.rootResidualArcsec));
const closestToZero = curve.reduce((best, point) =>
  Math.abs(point.gregorianCycleDriftDays) < Math.abs(best.gregorianCycleDriftDays)
    ? point : best
);

const result = Object.freeze({
  schemaVersion:1,
  researchOnly:true,
  catalogueYear:TARGET_YEAR,
  referenceSemantics:"geocentric-apparent-solar-longitude-mean-ecliptic-of-date",
  timeScale:"TT",
  sampling:Object.freeze({
    longitudeStepDegrees:1,
    crossingCount:curve.length,
    namedTermCount:terms.length,
    chronologicalStartLongitudeDegrees:270,
    chronologicalEndLongitudeDegrees:269
  }),
  summary:Object.freeze({
    minDriftDays,
    maxDriftDays,
    peakToPeakDriftDays:maxDriftDays - minDriftDays,
    closestToZero:Object.freeze({
      longitudeDegrees:closestToZero.longitudeDegrees,
      name:closestToZero.name,
      driftDays:closestToZero.gregorianCycleDriftDays
    }),
    allSampledLongitudesMoreThanOneDayFromGregorianCycle:
      curve.every(point => Math.abs(point.gregorianCycleDriftDays) > 1)
  }),
  validation:Object.freeze({
    rootToleranceSeconds:ROOT_TOLERANCE_SECONDS,
    maxRootResidualArcsec,
    regressionGateSeconds:REGRESSION_GATE_SECONDS,
    maxRegressionSeconds,
    regressions:Object.freeze(regressions),
    frameProbeCalls:probeCalls
  }),
  terms:Object.freeze(terms),
  curve:Object.freeze(curve),
  claimBoundary:Object.freeze({
    continuousLongitudeTimelineResolved:true,
    longitudeResolutionDegrees:1,
    solarMassLossIncluded:true,
    asteroid343Included:false,
    owenLongTermFrameApplied:true,
    apparentDirectionModelApplied:true,
    targetYearFrameIndependentlyValidated:false,
    civilTimeResolved:false,
    deltaTOrFutureUtcResolved:false,
    productionAuthorityGranted:false
  })
});

writeFileSync(output, JSON.stringify(result, null, 2) + "\n");

console.log(JSON.stringify({
  sampling:result.sampling,
  summary:result.summary,
  validation:{
    maxRootResidualArcsec:result.validation.maxRootResidualArcsec,
    maxRegressionSeconds:result.validation.maxRegressionSeconds,
    frameProbeCalls:result.validation.frameProbeCalls
  },
  terms:result.terms.map(term => ({
    name:term.name,
    longitudeDegrees:term.longitudeDegrees,
    driftDays:term.gregorianCycleDriftDays,
    date:term.prolepticGregorianTt
  }))
}, null, 2));
