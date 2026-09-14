import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ttJulianDayToTdbJulianDay } from "../src/astronomy/naif-tt-tdb-time-bridge.js";
import { aberrateNaturalDirection } from "../src/astronomy/absolute-state-seasonal-solver.js";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "tmp/horizons-sun-apparent-correction";
const API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";
const REQUEST_DELAY_MS = 1500;
const ARCSEC_PER_RADIAN = 206264.80624709636;

const samples = Object.freeze([
  { label:"2026-march", jdTt:2461120.0 },
  { label:"2026-june", jdTt:2461212.5 },
  { label:"2026-september", jdTt:2461306.5 },
  { label:"2026-december", jdTt:2461396.0 },
  { label:"4006-march", jdTt:3184300.0 },
  { label:"4006-june", jdTt:3184392.5 },
  { label:"4006-september", jdTt:3184486.5 },
  { label:"4006-december", jdTt:3184576.0 }
]).map(sample => Object.freeze({ ...sample, jdTdb:ttJulianDayToTdbJulianDay(sample.jdTt) }));

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function horizonsUrl(params) {
  const url = new URL(API_URL);
  for (const [key, value] of Object.entries({
    format:"text",
    OBJ_DATA:"'NO'",
    MAKE_EPHEM:"'YES'",
    CSV_FORMAT:"'YES'",
    ...params
  })) url.searchParams.set(key, value);
  return url;
}

function observerUrl() {
  return horizonsUrl({
    COMMAND:"'10'",
    CENTER:"'500@399'",
    EPHEM_TYPE:"'OBSERVER'",
    TIME_TYPE:"'TT'",
    TLIST_TYPE:"'JD'",
    TLIST:samples.map(sample => `'${sample.jdTt}'`).join(" "),
    QUANTITIES:"'45'",
    REF_SYSTEM:"'ICRF'",
    ANG_FORMAT:"'DEG'",
    EXTRA_PREC:"'YES'",
    CAL_FORMAT:"'JD'",
    TIME_DIGITS:"'FRACSEC'"
  });
}

function sunVectorUrl(correction) {
  return horizonsUrl({
    COMMAND:"'10'",
    CENTER:"'500@399'",
    EPHEM_TYPE:"'VECTORS'",
    TLIST_TYPE:"'JD'",
    TLIST:samples.map(sample => `'${sample.jdTdb.toFixed(12)}'`).join(" "),
    OUT_UNITS:"'AU-D'",
    REF_SYSTEM:"'ICRF'",
    REF_PLANE:"'FRAME'",
    VEC_TABLE:"'2'",
    VEC_CORR:`'${correction}'`,
    VEC_LABELS:"'YES'",
    VEC_DELTA_T:"'NO'"
  });
}

function earthBarycentricUrl() {
  return horizonsUrl({
    COMMAND:"'399'",
    CENTER:"'500@0'",
    EPHEM_TYPE:"'VECTORS'",
    TLIST_TYPE:"'JD'",
    TLIST:samples.map(sample => `'${sample.jdTdb.toFixed(12)}'`).join(" "),
    OUT_UNITS:"'AU-D'",
    REF_SYSTEM:"'ICRF'",
    REF_PLANE:"'FRAME'",
    VEC_TABLE:"'2'",
    VEC_CORR:"'NONE'",
    VEC_LABELS:"'YES'",
    VEC_DELTA_T:"'NO'"
  });
}

function ephemerisLines(text) {
  const start = text.indexOf("$$SOE");
  const end = text.indexOf("$$EOE");
  if (start < 0 || end <= start) return [];
  return text.slice(start + 5, end)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

async function capture(name, url) {
  console.log(`Capturing ${name}...`);
  const response = await fetch(url, { headers:{ "User-Agent":"bazi-time-atlas-research/1.0" } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${name}: Horizons HTTP ${response.status}: ${text.slice(0, 1000)}`);
  const rows = ephemerisLines(text);
  if (rows.length !== samples.length) {
    throw new Error(`${name}: expected ${samples.length} rows, got ${rows.length}: ${text.slice(-1800)}`);
  }
  const filename = `${name}.txt`;
  await writeFile(path.join(OUTPUT_DIR, filename), text);
  return Object.freeze({
    name,
    filename,
    requestUrl:url.toString(),
    bytes:Buffer.byteLength(text),
    sha256:sha256(text),
    rowCount:rows.length,
    rows:Object.freeze(rows)
  });
}

function parseObserverDirection(row) {
  const fields = row.split(",").map(value => value.trim());
  const raRadians = Number(fields[3]) * Math.PI / 180;
  const decRadians = Number(fields[4]) * Math.PI / 180;
  const cosDec = Math.cos(decRadians);
  return [cosDec * Math.cos(raRadians), cosDec * Math.sin(raRadians), Math.sin(decRadians)];
}

function parseVectorRow(row) {
  const fields = row.split(",").map(value => value.trim());
  return Object.freeze({
    positionAu:Object.freeze([Number(fields[2]), Number(fields[3]), Number(fields[4])]),
    velocityAuPerDay:Object.freeze([Number(fields[5]), Number(fields[6]), Number(fields[7])])
  });
}

function unit(vector) {
  const magnitude = Math.hypot(...vector);
  return vector.map(value => value / magnitude);
}

function angularDistanceArcsec(a, b) {
  const x = unit(a);
  const y = unit(b);
  const cross = [
    x[1] * y[2] - x[2] * y[1],
    x[2] * y[0] - x[0] * y[2],
    x[0] * y[1] - x[1] * y[0]
  ];
  const dot = x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  return Math.atan2(Math.hypot(...cross), dot) * ARCSEC_PER_RADIAN;
}

await mkdir(OUTPUT_DIR, { recursive:true });
const observer = await capture("sun-observer-q45-tt", observerUrl());
await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
const vectorLtS = await capture("sun-vector-lt-plus-s-tdb", sunVectorUrl("LT+S"));
await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
const vectorLt = await capture("sun-vector-lt-tdb", sunVectorUrl("LT"));
await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
const earthBarycentric = await capture("earth-barycentric-none-tdb", earthBarycentricUrl());

const comparisons = samples.map((sample, index) => {
  const observerDirection = parseObserverDirection(observer.rows[index]);
  const ltPlusSState = parseVectorRow(vectorLtS.rows[index]);
  const ltState = parseVectorRow(vectorLt.rows[index]);
  const earthState = parseVectorRow(earthBarycentric.rows[index]);
  const ltDirection = unit(ltState.positionAu);
  const ltPlusSDirection = unit(ltPlusSState.positionAu);
  const sunObserverDistanceAu = Math.hypot(...ltState.positionAu);
  const repoAberratedDirection = aberrateNaturalDirection({
    naturalDirection:ltDirection,
    observerBarycentricVelocityAuPerDay:earthState.velocityAuPerDay,
    sunObserverDistanceAu
  });
  return Object.freeze({
    label:sample.label,
    jdTt:sample.jdTt,
    jdTdb:sample.jdTdb,
    observerQ45MinusLtPlusSArcsec:angularDistanceArcsec(observerDirection, ltPlusSDirection),
    ltMinusLtPlusSArcsec:angularDistanceArcsec(ltDirection, ltPlusSDirection),
    repoAberrationMinusLtPlusSArcsec:angularDistanceArcsec(repoAberratedDirection, ltPlusSDirection),
    sunObserverDistanceAu
  });
});

function stats(field) {
  const values = comparisons.map(item => item[field]);
  return Object.freeze({
    max:Math.max(...values),
    min:Math.min(...values),
    mean:values.reduce((sum, value) => sum + value, 0) / values.length
  });
}

const manifest = Object.freeze({
  capturedAt:new Date().toISOString(),
  authority:"NASA/JPL Horizons API",
  purpose:"research-only comparison of Sun observer quantity #45 against Sun geocentric vector LT+S/LT directions and the repository SOFA-compatible aberration implementation",
  contract:Object.freeze({
    target:"Sun (10)",
    center:"Earth geocenter (500@399)",
    observerQuantity45:"ICRF apparent RA/DEC; Horizons observer-table apparent corrections",
    vectorLtPlusS:"ICRF FRAME vector with down-leg light-time + stellar aberration",
    vectorLt:"ICRF FRAME vector with down-leg light-time only",
    earthBarycentricState:"Earth (399) relative to SSB (0), ICRF/TDB, geometric NONE",
    observerTimeScale:"TT",
    vectorTimeScale:"TDB",
    ttToTdbBridge:"repo NAIF/SPICE DELTET fixed-point bridge",
    samples
  }),
  records:Object.freeze([observer, vectorLtS, vectorLt, earthBarycentric]),
  comparisons:Object.freeze(comparisons),
  summary:Object.freeze({
    observerQ45MinusLtPlusSArcsec:stats("observerQ45MinusLtPlusSArcsec"),
    ltMinusLtPlusSArcsec:stats("ltMinusLtPlusSArcsec"),
    repoAberrationMinusLtPlusSArcsec:stats("repoAberrationMinusLtPlusSArcsec")
  })
});
await writeFile(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
