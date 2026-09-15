import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ttJulianDayToTdbJulianDay } from "../src/astronomy/naif-tt-tdb-time-bridge.js";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "tmp/de441-apparent-proof-windows";
const API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";
const CENTER = "500@0"; // Solar-system barycenter
const REQUEST_DELAY_MS = 1500;

const epochs = Object.freeze([
  { label:"2026-march", jdTt:2461120.0 },
  { label:"2026-june", jdTt:2461212.5 },
  { label:"2026-september", jdTt:2461306.5 },
  { label:"2026-december", jdTt:2461396.0 },
  { label:"4006-march", jdTt:3184300.0 },
  { label:"4006-june", jdTt:3184392.5 },
  { label:"4006-september", jdTt:3184486.5 },
  { label:"4006-december", jdTt:3184576.0 }
]).map(item => Object.freeze({
  ...item,
  jdTdb:ttJulianDayToTdbJulianDay(item.jdTt)
}));

const tdbSampleTimes = Object.freeze(epochs.flatMap(item => [item.jdTdb - 1, item.jdTdb]));

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function requestUrl(targetId) {
  const url = new URL(API_URL);
  const params = {
    format:"text",
    COMMAND:`'${targetId}'`,
    OBJ_DATA:"'NO'",
    MAKE_EPHEM:"'YES'",
    EPHEM_TYPE:"'VECTORS'",
    CENTER:`'${CENTER}'`,
    TIME_TYPE:"'TDB'",
    TLIST_TYPE:"'JD'",
    TLIST:tdbSampleTimes.map(value => `'${value.toFixed(12)}'`).join(" "),
    REF_SYSTEM:"'ICRF'",
    REF_PLANE:"'FRAME'",
    VEC_TABLE:"'2'",
    VEC_CORR:"'NONE'",
    OUT_UNITS:"'AU-D'",
    CSV_FORMAT:"'YES'",
    TIME_DIGITS:"'FRACSEC'"
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
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

await mkdir(OUTPUT_DIR, { recursive:true });
const records = [];
for (const [index, target] of [{ id:"399", name:"earth" }, { id:"10", name:"sun" }].entries()) {
  if (index) await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
  const url = requestUrl(target.id);
  console.log(`Capturing ${target.name} barycentric DE441 states...`);
  const response = await fetch(url, { headers:{ "User-Agent":"bazi-time-atlas-research/1.0" } });
  const text = await response.text();
  const lines = ephemerisLines(text);
  const filename = `${target.name}-de441-icrf-tdb.txt`;
  await writeFile(path.join(OUTPUT_DIR, filename), text);
  if (!response.ok || lines.length !== tdbSampleTimes.length) {
    throw new Error(`${target.name}: expected ${tdbSampleTimes.length} rows, got ${lines.length}, HTTP ${response.status}: ${text.slice(-1800)}`);
  }
  records.push({
    ...target,
    filename,
    requestUrl:url.toString(),
    bytes:Buffer.byteLength(text),
    sha256:sha256(text),
    rowCount:lines.length,
    ephemerisLines:lines
  });
}

const manifest = {
  capturedAt:new Date().toISOString(),
  authority:"NASA/JPL Horizons API",
  sourceEphemeris:"DE441",
  purpose:"research-only Earth/Sun barycentric ICRF/TDB state windows for reconstructing Sun-from-Earth LT+S from geometric DE441 states",
  contract:{
    center:"Solar System barycenter (500@0)",
    referenceFrame:"ICRF",
    timeScale:"TDB",
    units:"AU/day",
    vectorCorrection:"NONE",
    interpolationWindow:"one day ending at each reception epoch",
    epochs,
    tdbSampleTimes
  },
  records
};
await writeFile(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
