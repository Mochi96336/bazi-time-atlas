import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import {
  HORIZONS_4006_FRAME_INTERPOLATION_CASES
} from "../tests/fixtures/horizons-ecliptic-frame-proof.js";
import {
  HORIZONS_4006_PREVIOUS_WINTER_SOLSTICE_FRAME_CASE
} from "../tests/fixtures/horizons-ecliptic-frame-catalogue-proof.js";

const probe = process.env.OWEN_FRAME_PROBE;
const output = process.env.OUTPUT_JSON;
if (!probe) throw new Error("OWEN_FRAME_PROBE is required");
if (!output) throw new Error("OUTPUT_JSON is required");

function unit([longitudeDegrees, latitudeDegrees]) {
  const lon = longitudeDegrees * Math.PI / 180;
  const lat = latitudeDegrees * Math.PI / 180;
  const cosLat = Math.cos(lat);
  return [
    cosLat * Math.cos(lon),
    cosLat * Math.sin(lon),
    Math.sin(lat)
  ];
}

function signedAngularArcsec(actualDegrees, expectedDegrees) {
  let delta = actualDegrees - expectedDegrees;
  while (delta <= -180) delta += 360;
  while (delta > 180) delta -= 360;
  return delta * 3600;
}

function separationArcsec(a, b) {
  const cross = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.atan2(Math.hypot(...cross), dot) * 206264.80624709636;
}

function runProbe(mode, jdTt, icrf) {
  const run = spawnSync(probe, [
    mode,
    String(jdTt),
    String(icrf[0]),
    String(icrf[1])
  ], { encoding:"utf8" });
  if (run.status !== 0) {
    const stderr = (run.stderr ?? "").trim();
    if (stderr) process.stderr.write(stderr + "\n");
    throw new Error(
      `Owen probe failed at TT JD ${jdTt}; status=${run.status}; signal=${run.signal ?? "none"}`
      + (stderr ? `; stderr=${stderr}` : "")
    );
  }
  const values = run.stdout.trim().split(/\s+/).map(Number);
  if (values.length !== 3 || values.some(value => !Number.isFinite(value))) {
    throw new Error(`malformed Owen probe output: ${run.stdout}`);
  }
  return {
    ecliptic:[values[0], values[1]],
    obliquityDegrees:values[2]
  };
}

const samples = [];
for (const proofCase of HORIZONS_4006_FRAME_INTERPOLATION_CASES) {
  for (const target of ["sun", "moon"]) {
    samples.push({
      id:`worst-region-${proofCase.jdTt}-${target}`,
      jdTt:proofCase.jdTt,
      target,
      icrf:proofCase.truth[target].icrf,
      expected:proofCase.truth[target].ecliptic
    });
  }
}
for (const target of ["sun", "moon"]) {
  samples.push({
    id:`previous-winter-${HORIZONS_4006_PREVIOUS_WINTER_SOLSTICE_FRAME_CASE.jdTt}-${target}`,
    jdTt:HORIZONS_4006_PREVIOUS_WINTER_SOLSTICE_FRAME_CASE.jdTt,
    target,
    icrf:HORIZONS_4006_PREVIOUS_WINTER_SOLSTICE_FRAME_CASE.truth[target].icrf,
    expected:HORIZONS_4006_PREVIOUS_WINTER_SOLSTICE_FRAME_CASE.truth[target].ecliptic
  });
}

const evaluate = mode => {
  const residuals = samples.map(sample => {
    const predicted = runProbe(mode, sample.jdTt, sample.icrf);
    return {
      ...sample,
      predicted:predicted.ecliptic,
      obliquityDegrees:predicted.obliquityDegrees,
      residualArcsec:separationArcsec(unit(predicted.ecliptic), unit(sample.expected)),
      longitudeResidualArcsec:signedAngularArcsec(predicted.ecliptic[0], sample.expected[0]),
      latitudeResidualArcsec:(predicted.ecliptic[1] - sample.expected[1]) * 3600
    };
  });
  const values = residuals.map(item => item.residualArcsec);
  return {
    mode,
    maxResidualArcsec:Math.max(...values),
    meanResidualArcsec:values.reduce((sum,value)=>sum+value,0)/values.length,
    samples:residuals
  };
};

const mean = evaluate("mean");
console.log(JSON.stringify({
  meanOnly:{
    maxResidualArcsec:mean.maxResidualArcsec,
    meanResidualArcsec:mean.meanResidualArcsec
  }
}, null, 2));
const apparent = evaluate("apparent");
const diagnostics = Object.fromEntries(["sun","moon"].map(target => {
  const rows = apparent.samples.filter(sample => sample.target === target);
  const mean = key => rows.reduce((sum,row)=>sum+row[key],0)/rows.length;
  return [target, {
    meanLongitudeResidualArcsec:mean("longitudeResidualArcsec"),
    meanLatitudeResidualArcsec:mean("latitudeResidualArcsec"),
    minLongitudeResidualArcsec:Math.min(...rows.map(row=>row.longitudeResidualArcsec)),
    maxLongitudeResidualArcsec:Math.max(...rows.map(row=>row.longitudeResidualArcsec)),
    minLatitudeResidualArcsec:Math.min(...rows.map(row=>row.latitudeResidualArcsec)),
    maxLatitudeResidualArcsec:Math.max(...rows.map(row=>row.latitudeResidualArcsec))
  }];
}));
console.log(JSON.stringify({ apparentDiagnostics:diagnostics }, null, 2));

const result = {
  schemaVersion:2,
  source:{
    implementation:"Swiss Ephemeris pinned Owen/JPLHOR frame path",
    swissCommit:"9083a12d59e98034fb2337061481ac8800c16e64",
    inputFrame:"ICRF apparent direction (Horizons quantity #45)",
    outputFrame:"Earth ecliptic-of-date apparent direction (Horizons quantity #31)"
  },
  validation:{
    catalogueYear:4006,
    sampleCount:samples.length,
    gateArcsec:0.05,
    mean:Object.fromEntries(Object.entries(mean).filter(([key])=>key!=="samples")),
    apparent:Object.fromEntries(Object.entries(apparent).filter(([key])=>key!=="samples"))
  },
  modes:{ mean:mean.samples, apparent:apparent.samples }
};

writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result.validation, null, 2));

if (result.validation.sampleCount !== 18) {
  throw new Error(`expected 18 pinned directions, got ${result.validation.sampleCount}`);
}
if (!(result.validation.apparent.maxResidualArcsec < result.validation.gateArcsec)) {
  const worst = apparent.samples.toSorted((a,b)=>b.residualArcsec-a.residualArcsec)[0];
  throw new Error(
    `Owen/JPLHOR apparent frame misses pinned Horizons truth: max=${result.validation.apparent.maxResidualArcsec}" `
    + `at ${worst.id}; gate=${result.validation.gateArcsec}"`
  );
}
