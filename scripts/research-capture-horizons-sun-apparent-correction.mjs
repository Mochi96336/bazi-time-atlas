import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ttJulianDayToTdbJulianDay } from "../src/astronomy/naif-tt-tdb-time-bridge.js";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "tmp/horizons-sun-apparent-correction";
const API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";
const REQUEST_DELAY_MS = 1500;

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

function withCommonParams(params) {
  const url = new URL(API_URL);
  for (const [key, value] of Object.entries({
    format:"text",
    COMMAND:"'10'",
    OBJ_DATA:"'NO'",
    MAKE_EPHEM:"'YES'",
    CENTER:"'500@399'",
    CSV_FORMAT:"'YES'",
    ...params
  })) url.searchParams.set(key, value);
  return url;
}

function observerUrl() {
  return withCommonParams({
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

function vectorUrl(correction) {
  return withCommonParams({
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

await mkdir(OUTPUT_DIR, { recursive:true });
const observer = await capture("sun-observer-q45-tt", observerUrl());
await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
const vectorLtS = await capture("sun-vector-lt-plus-s-tdb", vectorUrl("LT+S"));
await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
const vectorLt = await capture("sun-vector-lt-tdb", vectorUrl("LT"));

const manifest = Object.freeze({
  capturedAt:new Date().toISOString(),
  authority:"NASA/JPL Horizons API",
  purpose:"research-only comparison of Sun observer quantity #45 against Sun geocentric vector LT+S and LT directions to isolate the apparent-correction boundary",
  contract:Object.freeze({
    target:"Sun (10)",
    center:"Earth geocenter (500@399)",
    observerQuantity45:"ICRF apparent RA/DEC; Horizons observer-table apparent corrections",
    vectorLtPlusS:"ICRF FRAME vector with down-leg light-time + stellar aberration",
    vectorLt:"ICRF FRAME vector with down-leg light-time only",
    observerTimeScale:"TT",
    vectorTimeScale:"TDB",
    ttToTdbBridge:"repo NAIF/SPICE DELTET fixed-point bridge",
    samples
  }),
  records:Object.freeze([observer, vectorLtS, vectorLt])
});
await writeFile(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
