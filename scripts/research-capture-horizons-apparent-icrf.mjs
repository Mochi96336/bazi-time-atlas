import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "tmp/horizons-apparent-icrf-capture";
const API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";
const TARGET_ID = "10"; // Sun center
const CENTER = "500@399"; // Earth geocenter
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
]);

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function commonParams() {
  return {
    format:"text",
    COMMAND:`'${TARGET_ID}'`,
    OBJ_DATA:"'NO'",
    MAKE_EPHEM:"'YES'",
    CENTER:`'${CENTER}'`,
    TIME_TYPE:"'TT'",
    TLIST_TYPE:"'JD'",
    TLIST:epochs.map(item => `'${item.jdTt}'`).join(" "),
    REF_SYSTEM:"'ICRF'",
    CSV_FORMAT:"'YES'",
    TIME_DIGITS:"'FRACSEC'"
  };
}

function makeUrl(extraParams) {
  const url = new URL(API_URL);
  for (const [key, value] of Object.entries({ ...commonParams(), ...extraParams })) {
    url.searchParams.set(key, value);
  }
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

async function capture(label, extraParams) {
  const url = makeUrl(extraParams);
  console.log(`Capturing ${label}...`);
  const response = await fetch(url, { headers:{ "User-Agent":"bazi-time-atlas-research/1.0" } });
  const text = await response.text();
  const lines = ephemerisLines(text);
  const filename = `${label}.txt`;
  await writeFile(path.join(OUTPUT_DIR, filename), text);
  const record = {
    label,
    filename,
    requestUrl:url.toString(),
    httpStatus:response.status,
    bytes:Buffer.byteLength(text),
    sha256:sha256(text),
    rowCount:lines.length,
    ephemerisLines:lines,
    tail:text.slice(-1800)
  };
  if (!response.ok || lines.length !== epochs.length) {
    throw new Error(`${label}: expected ${epochs.length} rows, got ${lines.length}, HTTP ${response.status}: ${record.tail}`);
  }
  return record;
}

await mkdir(OUTPUT_DIR, { recursive:true });
const records = [];
records.push(await capture("observer-q1-q21-q45", {
  EPHEM_TYPE:"'OBSERVER'",
  QUANTITIES:"'1,21,45'",
  ANG_FORMAT:"'DEG'",
  EXTRA_PREC:"'YES'",
  CAL_FORMAT:"'JD'"
}));

for (const correction of ["NONE", "LT", "LT+S"]) {
  await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
  records.push(await capture(`vectors-${correction.toLowerCase().replace("+", "-plus-")}`, {
    EPHEM_TYPE:"'VECTORS'",
    REF_PLANE:"'FRAME'",
    VEC_TABLE:"'3'",
    VEC_CORR:`'${correction}'`,
    OUT_UNITS:"'AU-D'"
  }));
}

const manifest = {
  capturedAt:new Date().toISOString(),
  authority:"NASA/JPL Horizons API",
  purpose:"research-only decomposition of Sun-from-Earth geometric, light-time, stellar-aberration, and observer-table apparent-ICRF layers",
  contract:{
    target:"Sun center (10)",
    observer:"Earth geocenter (500@399)",
    inputTimeScale:"TT",
    referenceSystem:"ICRF",
    epochs,
    observerQuantities:Object.freeze({
      1:"astrometric ICRF RA/DEC; observer manual defines this as light-time corrected",
      21:"one-way down-leg light-time in minutes",
      45:"inertial apparent ICRF RA/DEC; light-time + gravitational deflection + stellar aberration"
    }),
    vectorCorrections:Object.freeze({
      NONE:"geometric relative state",
      LT:"one-way light-time corrected relative state",
      "LT+S":"one-way light-time plus stellar-aberration corrected relative state"
    }),
    boundary:"Horizons vector aberration corrections do not themselves include gravitational light deflection; observer quantity #45 does."
  },
  records
};
await writeFile(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
