import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  MEAN_ECLIPTIC_OF_DATE_FRAME_SEMANTICS,
  roughSeasonalCrossingTtJulianDay,
  solveSeasonalCrossingFromAbsoluteState
} from "../src/astronomy/absolute-state-seasonal-solver.js";
import { createDe441StateSegmentProofAdapter } from "../src/astronomy/de441-state-segment-adapter.js";
import { ttJulianDayToTdbJulianDay } from "../src/astronomy/naif-tt-tdb-time-bridge.js";
import { HORIZONS_SUN_APPARENT_DIRECTION_PROOF_MODEL } from "../src/astronomy/horizons-sun-apparent-direction-proof.js";
import { DE441_10026_STATE_CAPTURE_EVIDENCE } from "../src/astronomy/de441-10026-state-capture-evidence.js";
import { OWEN_HORIZONS_FRAME_PROOF_CONTRACT } from "../src/astronomy/owen-horizons-frame-proof-contract.js";

const TARGET_YEAR = 10026;
const ROOT_TOLERANCE_SECONDS = 0.005;
const SEED_PARITY_GATE_SECONDS = 0.02;
const ROOT_RESIDUAL_GATE_ARCSEC = 0.001;
const probe = process.env.OWEN_FRAME_PROBE;
const capturePath = process.env.STATE_CAPTURE_JSON;
const output = process.env.OUTPUT_JSON ?? "tmp/de441-10026-seasonal-crossing-proof.json";

if (!probe) throw new Error("OWEN_FRAME_PROBE is required");
if (!capturePath) throw new Error("STATE_CAPTURE_JSON is required");

const TERM_BY_LONGITUDE = new Map([
  [270,"冬至"],[285,"小寒"],[300,"大寒"],[315,"立春"],[330,"雨水"],[345,"驚蟄"],
  [0,"春分"],[15,"清明"],[30,"穀雨"],[45,"立夏"],[60,"小滿"],[75,"芒種"],
  [90,"夏至"],[105,"小暑"],[120,"大暑"],[135,"立秋"],[150,"處暑"],[165,"白露"],
  [180,"秋分"],[195,"寒露"],[210,"霜降"],[225,"立冬"],[240,"小雪"],[255,"大雪"]
]);
const CHRONOLOGICAL_LONGITUDES = Object.freeze([
  270,285,300,315,330,345,
  0,15,30,45,60,75,90,105,120,135,150,165,180,195,210,225,240,255
]);

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

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

const captureRaw = readFileSync(capturePath, "utf8");
const captureCanonical = captureRaw.trimEnd();
const captureSha256 = sha256(captureCanonical);
if (captureSha256 !== DE441_10026_STATE_CAPTURE_EVIDENCE.capture.sha256) {
  throw new Error(
    `10026 state capture SHA mismatch: expected ${DE441_10026_STATE_CAPTURE_EVIDENCE.capture.sha256}, got ${captureSha256}`
  );
}
const capture = JSON.parse(captureCanonical);
if (capture.catalogueYear !== TARGET_YEAR) throw new Error("wrong state-capture catalogue year");
if (capture.stateContract.referenceFrame !== "ICRF" || capture.stateContract.timeScale !== "TDB") {
  throw new Error("10026 state capture must remain ICRF/TDB");
}
if (capture.daily.sampleCount !== DE441_10026_STATE_CAPTURE_EVIDENCE.capture.dailySamples) {
  throw new Error("unexpected daily state sample count");
}

const window = Object.freeze({
  startTdbJulianDay:capture.daily.startTdbJulianDay,
  stepDays:capture.daily.stepDays,
  sampleCount:capture.daily.sampleCount,
  earth:capture.bodies.earth.daily,
  sun:capture.bodies.sun.daily
});
const adapter = createDe441StateSegmentProofAdapter({
  id:"jpl-de441-10026-daily-state-proof-adapter",
  windows:[window],
  provenance:Object.freeze({
    sourceEphemeris:"DE441",
    referenceFrame:"ICRF",
    timeScale:"TDB",
    captureEvidenceId:DE441_10026_STATE_CAPTURE_EVIDENCE.id,
    captureSha256
  }),
  ttToTdbJulianDay:ttJulianDayToTdbJulianDay
});
const frameTransform = Object.freeze({
  id:"swiss-owen-horizons-frame-proof-10026-source-derived",
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

function solve(longitudeDegrees, seedShiftDays, initialHalfBracketDays) {
  const seed = roughSeasonalCrossingTtJulianDay({
    year:TARGET_YEAR,
    longitudeDegrees
  }) + seedShiftDays;
  return solveSeasonalCrossingFromAbsoluteState({
    year:TARGET_YEAR,
    longitudeDegrees,
    seedTtJulianDay:seed,
    initialHalfBracketDays,
    maxHalfBracketDays:16,
    toleranceSeconds:ROOT_TOLERANCE_SECONDS,
    stateAdapter:adapter,
    frameTransform,
    corrections
  });
}

const events = CHRONOLOGICAL_LONGITUDES.map(longitudeDegrees => {
  const primary = solve(longitudeDegrees, 0, 2);
  const alternate = solve(longitudeDegrees, longitudeDegrees % 30 === 0 ? 1.25 : -1.25, 3);
  const seedParitySeconds = Math.abs(primary.ttJulianDay - alternate.ttJulianDay) * 86400;
  return Object.freeze({
    name:TERM_BY_LONGITUDE.get(longitudeDegrees),
    longitudeDegrees,
    ttJulianDay:primary.ttJulianDay,
    rootResidualArcsec:primary.residualDegrees * 3600,
    seedParitySeconds,
    primaryIterations:primary.iterations,
    primaryBracketHalfWidthDays:primary.bracketHalfWidthDays
  });
});

if (events.length !== 24) throw new Error(`expected 24 crossings, got ${events.length}`);
if (new Set(events.map(event => event.longitudeDegrees)).size !== 24) {
  throw new Error("canonical longitude set is incomplete");
}
for (let index = 1; index < events.length; index += 1) {
  if (!(events[index].ttJulianDay > events[index - 1].ttJulianDay)) {
    throw new Error(
      `crossing order is not monotonic at ${events[index - 1].name} -> ${events[index].name}`
    );
  }
}

const spacingsDays = events.slice(1).map((event,index) =>
  event.ttJulianDay - events[index].ttJulianDay
);
const maxRootResidualArcsec = Math.max(...events.map(event => event.rootResidualArcsec));
const maxSeedParitySeconds = Math.max(...events.map(event => event.seedParitySeconds));
const minSpacingDays = Math.min(...spacingsDays);
const maxSpacingDays = Math.max(...spacingsDays);
if (!(maxRootResidualArcsec < ROOT_RESIDUAL_GATE_ARCSEC)) {
  throw new Error(`root residual gate failed: ${maxRootResidualArcsec} arcsec`);
}
if (!(maxSeedParitySeconds < SEED_PARITY_GATE_SECONDS)) {
  throw new Error(`seed parity gate failed: ${maxSeedParitySeconds} s`);
}
if (!(minSpacingDays > 10 && maxSpacingDays < 25)) {
  throw new Error(`implausible seasonal spacing range: ${minSpacingDays}..${maxSpacingDays} days`);
}

const liChun = events.find(event => event.longitudeDegrees === 315);
if (!liChun) throw new Error("315° Li Chun crossing is missing");

const result = Object.freeze({
  schemaVersion:1,
  catalogueYear:TARGET_YEAR,
  referenceSemantics:"geocentric-apparent-solar-longitude-mean-ecliptic-of-date",
  timeScale:"TT",
  claimBoundary:Object.freeze({
    sourceEphemeris:"DE441",
    sourceStateEvidenceId:DE441_10026_STATE_CAPTURE_EVIDENCE.id,
    sourceStateCaptureSha256:captureSha256,
    apparentDirectionModelId:HORIZONS_SUN_APPARENT_DIRECTION_PROOF_MODEL.id,
    frameProofId:OWEN_HORIZONS_FRAME_PROOF_CONTRACT.id,
    frameIndependentValidationCatalogueYear:4006,
    independentTargetYearTruth:false,
    sourceDerivedTargetYear:true,
    civilTimeResolved:false,
    productionIntegrated:false
  }),
  validation:Object.freeze({
    solvedCrossings:events.length,
    canonicalCrossings:24,
    rootToleranceSeconds:ROOT_TOLERANCE_SECONDS,
    rootResidualGateArcsec:ROOT_RESIDUAL_GATE_ARCSEC,
    maxRootResidualArcsec,
    seedParityGateSeconds:SEED_PARITY_GATE_SECONDS,
    maxSeedParitySeconds,
    minSpacingDays,
    maxSpacingDays,
    frameProbeCalls:probeCalls
  }),
  liChun:Object.freeze({
    longitudeDegrees:315,
    ttJulianDay:liChun.ttJulianDay
  }),
  events:Object.freeze(events)
});

writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({
  catalogueYear:result.catalogueYear,
  solvedCrossings:result.validation.solvedCrossings,
  maxRootResidualArcsec:result.validation.maxRootResidualArcsec,
  maxSeedParitySeconds:result.validation.maxSeedParitySeconds,
  minSpacingDays:result.validation.minSpacingDays,
  maxSpacingDays:result.validation.maxSpacingDays,
  liChunTtJulianDay:result.liChun.ttJulianDay,
  frameProbeCalls:result.validation.frameProbeCalls
}, null, 2));
