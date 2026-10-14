import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  MEAN_ECLIPTIC_OF_DATE_FRAME_SEMANTICS,
  roughSeasonalCrossingTtJulianDay,
  solveSeasonalCrossingFromAbsoluteState
} from "../src/astronomy/absolute-state-seasonal-solver.js";
import { ttJulianDayToTdbJulianDay } from "../src/astronomy/naif-tt-tdb-time-bridge.js";
import { HORIZONS_SUN_APPARENT_DIRECTION_PROOF_MODEL } from "../src/astronomy/horizons-sun-apparent-direction-proof.js";
import { OWEN_HORIZONS_FRAME_PROOF_CONTRACT } from "../src/astronomy/owen-horizons-frame-proof-contract.js";

const TARGET_YEAR = 26026;
const ROOT_TOLERANCE_SECONDS = 0.5;
const probe = process.env.OWEN_FRAME_PROBE;
const statePath = process.env.STATE_PROJECTION_JSON;
const output = process.env.OUTPUT_JSON ?? "tmp/rebound-26026-seasonal-day-boundary-triage.json";

if (!probe) throw new Error("OWEN_FRAME_PROBE is required");
if (!statePath) throw new Error("STATE_PROJECTION_JSON is required");

const TARGETS = Object.freeze([
  Object.freeze({ name:"立春", longitudeDegrees:315, windowLabel:"li-chun-window" }),
  Object.freeze({ name:"春分", longitudeDegrees:0, windowLabel:"march-equinox-window" }),
  Object.freeze({ name:"秋分", longitudeDegrees:180, windowLabel:"september-equinox-window" })
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

function buildWindow(raw) {
  if (raw.catalogueYear !== TARGET_YEAR) throw new Error(`wrong window year for ${raw.label}`);
  if (!(raw.stepDays > 0) || raw.samples.length !== raw.sampleCount) {
    throw new Error(`invalid state window ${raw.label}`);
  }
  return Object.freeze({
    label:raw.label,
    centerTdbJulianDay:raw.centerTdbJulianDay,
    startTdbJulianDay:raw.startTdbJulianDay,
    endTdbJulianDay:raw.startTdbJulianDay + raw.stepDays * (raw.sampleCount - 1),
    stepDays:raw.stepDays,
    sampleCount:raw.sampleCount,
    samples:Object.freeze(raw.samples.map(sample => Object.freeze({
      earth:freezeState(sample.earth),
      sun:freezeState(sample.sun)
    })))
  });
}

function makeProjectionAdapter(projection) {
  if (projection.researchOnly !== true) throw new Error("projection must remain research-only");
  if (projection.target?.year !== TARGET_YEAR) throw new Error("wrong target year");
  if (projection.summary?.acceptedAsOrbitalStateProjection !== true) {
    throw new Error("source orbital projection was not accepted");
  }
  if (projection.claimBoundary?.year26026AbsoluteOrbitalStateProjected !== true) {
    throw new Error("source projection does not claim year-26026 orbital state");
  }
  if (projection.claimBoundary?.year26026Asteroid343Included !== false) {
    throw new Error("this triage lane expects the mass-loss-only projection");
  }

  const windows = Object.freeze(projection.target.stateWindows.map(buildWindow));

  function stateAt(tdbJulianDay) {
    const epsilon = 1e-9;
    const window = windows.find(item =>
      tdbJulianDay >= item.startTdbJulianDay - epsilon
      && tdbJulianDay <= item.endTdbJulianDay + epsilon
    );
    if (!window) {
      throw new RangeError(`TDB Julian Day ${tdbJulianDay} is outside the projected windows`);
    }
    const clamped = Math.min(window.endTdbJulianDay, Math.max(window.startTdbJulianDay, tdbJulianDay));
    const offset = (clamped - window.startTdbJulianDay) / window.stepDays;
    let leftIndex = Math.floor(offset);
    let fraction = offset - leftIndex;
    if (leftIndex >= window.sampleCount - 1) {
      leftIndex = window.sampleCount - 1;
      return Object.freeze({
        earth:window.samples[leftIndex].earth,
        sun:window.samples[leftIndex].sun
      });
    }
    return Object.freeze({
      earth:hermiteState(
        window.samples[leftIndex].earth,
        window.samples[leftIndex + 1].earth,
        fraction,
        window.stepDays
      ),
      sun:hermiteState(
        window.samples[leftIndex].sun,
        window.samples[leftIndex + 1].sun,
        fraction,
        window.stepDays
      )
    });
  }

  return Object.freeze({
    id:"rebound-ias15-gr-solar-massloss-26026-state-window",
    providerId:"rebound-ias15-gr-solar-massloss-projection",
    referenceFrame:"ICRF",
    ephemerisTimeScale:"TDB",
    proofOnly:true,
    productionIntegrated:false,
    ttToEphemerisJulianDay:ttJulianDayToTdbJulianDay,
    stateAtEphemerisJulianDay:stateAt,
    windows
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
  return Object.freeze({
    year,
    month,
    day,
    hoursFromMidnight,
    distanceToNearestMidnightHours:Math.min(hoursFromMidnight, 24 - hoursFromMidnight)
  });
}

const projection = JSON.parse(readFileSync(statePath, "utf8"));
const stateAdapter = makeProjectionAdapter(projection);
const frameTransform = Object.freeze({
  id:"swiss-owen-horizons-frame-proof-26026-source-projection",
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

const windowByLabel = new Map(stateAdapter.windows.map(window => [window.label, window]));

function solveTarget(target) {
  const seed = roughSeasonalCrossingTtJulianDay({
    year:TARGET_YEAR,
    longitudeDegrees:target.longitudeDegrees
  });
  const primary = solveSeasonalCrossingFromAbsoluteState({
    year:TARGET_YEAR,
    longitudeDegrees:target.longitudeDegrees,
    seedTtJulianDay:seed,
    initialHalfBracketDays:2,
    maxHalfBracketDays:16,
    toleranceSeconds:ROOT_TOLERANCE_SECONDS,
    stateAdapter,
    frameTransform,
    corrections
  });
  const alternate = solveSeasonalCrossingFromAbsoluteState({
    year:TARGET_YEAR,
    longitudeDegrees:target.longitudeDegrees,
    seedTtJulianDay:seed + 1.25,
    initialHalfBracketDays:3,
    maxHalfBracketDays:16,
    toleranceSeconds:ROOT_TOLERANCE_SECONDS,
    stateAdapter,
    frameTransform,
    corrections
  });
  const seedParitySeconds = Math.abs(primary.ttJulianDay - alternate.ttJulianDay) * 86400;
  const calendar = julianDayToProlepticGregorian(primary.ttJulianDay);
  const window = windowByLabel.get(target.windowLabel);
  if (!window) throw new Error(`missing source window ${target.windowLabel}`);

  return Object.freeze({
    ...target,
    ttJulianDay:primary.ttJulianDay,
    prolepticGregorianTt:calendar,
    offsetFromWindowCenterHours:(primary.ttJulianDay - window.centerTdbJulianDay) * 24,
    rootResidualArcsec:primary.residualDegrees * 3600,
    seedParitySeconds,
    sourceWindow:Object.freeze({
      centerTdbJulianDay:window.centerTdbJulianDay,
      startTdbJulianDay:window.startTdbJulianDay,
      endTdbJulianDay:window.endTdbJulianDay,
      stepDays:window.stepDays
    })
  });
}

const events = TARGETS.map(solveTarget);
const minDistanceToUniformMidnightHours = Math.min(
  ...events.map(event => event.prolepticGregorianTt.distanceToNearestMidnightHours)
);
const maxSeedParitySeconds = Math.max(...events.map(event => event.seedParitySeconds));
const maxRootResidualArcsec = Math.max(...events.map(event => event.rootResidualArcsec));

const result = Object.freeze({
  schemaVersion:1,
  researchOnly:true,
  catalogueYear:TARGET_YEAR,
  purpose:"day-boundary triage before deeper asteroid343 propagation",
  referenceSemantics:"geocentric-apparent-solar-longitude-mean-ecliptic-of-date",
  timeScale:"TT",
  sourceProjection:Object.freeze({
    pullRequest:569,
    sourceHeadSha:"43d10be8957dc785036aeec030e9034b9c384e7e",
    mergedMainSha:"0c037b18e708bb4ba67b72ffeabefb132a807463",
    artifactId:11840619960,
    massLossSegmentYears:projection.model.primaryMassLossSegmentYears,
    stateWindowStepDays:projection.target.stateWindows[0].stepDays,
    maxTenYearVsOneYearDirectionArcsec:projection.summary.maxTenYearVsOneYearDirectionArcsec
  }),
  validation:Object.freeze({
    solvedCrossings:events.length,
    rootToleranceSeconds:ROOT_TOLERANCE_SECONDS,
    maxRootResidualArcsec,
    maxSeedParitySeconds,
    frameProbeCalls:probeCalls
  }),
  triage:Object.freeze({
    minDistanceToUniformMidnightHours,
    asteroid343Deferred:true,
    decisionRule:"inspect uniform-TT day-boundary distance first; only deepen small-body modeling if the seasonal crossing is close enough to a day boundary to affect the research conclusion"
  }),
  events:Object.freeze(events),
  claimBoundary:Object.freeze({
    year26026AbsoluteOrbitalStateProjected:true,
    solarMassLossIncluded:true,
    asteroid343Included:false,
    owenLongTermFrameApplied:true,
    apparentDirectionModelApplied:true,
    seasonalCrossingsResolved:true,
    targetYearFrameIndependentlyValidated:false,
    uniformDynamicalTimeDayOnly:true,
    civilTimeResolved:false,
    deltaTOrFutureUtcResolved:false,
    productionAuthorityGranted:false
  })
});

writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({
  catalogueYear:result.catalogueYear,
  events:result.events.map(event => ({
    name:event.name,
    ttJulianDay:event.ttJulianDay,
    date:[event.prolepticGregorianTt.year,event.prolepticGregorianTt.month,event.prolepticGregorianTt.day].join("-"),
    hoursFromMidnight:event.prolepticGregorianTt.hoursFromMidnight,
    distanceToNearestMidnightHours:event.prolepticGregorianTt.distanceToNearestMidnightHours,
    offsetFromWindowCenterHours:event.offsetFromWindowCenterHours
  })),
  minDistanceToUniformMidnightHours:result.triage.minDistanceToUniformMidnightHours,
  maxRootResidualArcsec:result.validation.maxRootResidualArcsec,
  maxSeedParitySeconds:result.validation.maxSeedParitySeconds,
  frameProbeCalls:result.validation.frameProbeCalls
}, null, 2));
