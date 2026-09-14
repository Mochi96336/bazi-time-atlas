import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "tmp/horizons-ecliptic-frame-window";
const API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";
const REQUEST_DELAY_MS = 1500;

const datasets = [
  { targetId:"10", target:"sun", grid:"daily-knot", start:"4006-01-01 00:00", stop:"4007-01-01 00:00" },
  { targetId:"301", target:"moon", grid:"daily-knot", start:"4006-01-01 00:00", stop:"4007-01-01 00:00" },
  { targetId:"10", target:"sun", grid:"halfday-truth", start:"4006-01-01 12:00", stop:"4006-12-31 12:00" },
  { targetId:"301", target:"moon", grid:"halfday-truth", start:"4006-01-01 12:00", stop:"4006-12-31 12:00" }
];

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function requestUrl(dataset) {
  const url = new URL(API_URL);
  const params = {
    format:"text",
    COMMAND:`'${dataset.targetId}'`,
    OBJ_DATA:"'NO'",
    MAKE_EPHEM:"'YES'",
    EPHEM_TYPE:"'OBSERVER'",
    CENTER:"'500@399'",
    TIME_TYPE:"'TT'",
    START_TIME:`'${dataset.start}'`,
    STOP_TIME:`'${dataset.stop}'`,
    STEP_SIZE:"'1 d'",
    QUANTITIES:"'31,45'",
    REF_SYSTEM:"'ICRF'",
    ANG_FORMAT:"'DEG'",
    EXTRA_PREC:"'YES'",
    CAL_FORMAT:"'JD'",
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
for (const [index, dataset] of datasets.entries()) {
  if (index) await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
  const url = requestUrl(dataset);
  console.log(`Capturing ${dataset.target} ${dataset.grid}...`);
  const response = await fetch(url, { headers:{ "User-Agent":"bazi-time-atlas-research/1.0" } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${dataset.target}/${dataset.grid}: Horizons HTTP ${response.status}: ${text.slice(0, 500)}`);
  const lines = ephemerisLines(text);
  if (!lines.length) throw new Error(`${dataset.target}/${dataset.grid}: no ephemeris rows: ${text.slice(-1800)}`);
  if (!/ObsEcLon/.test(text) || !/RA_\(ICRF-a-app\)/.test(text)) {
    throw new Error(`${dataset.target}/${dataset.grid}: expected quantity #31 and #45 labels were not found`);
  }
  const filename = `${dataset.target}-${dataset.grid}-q31-q45-tt.txt`;
  await writeFile(path.join(OUTPUT_DIR, filename), text);
  records.push({
    ...dataset,
    filename,
    requestUrl:url.toString(),
    bytes:Buffer.byteLength(text),
    sha256:sha256(text),
    rowCount:lines.length,
    firstRow:lines[0],
    lastRow:lines.at(-1)
  });
}

const knotRows = records.filter(item => item.grid === "daily-knot").map(item => item.rowCount);
const truthRows = records.filter(item => item.grid === "halfday-truth").map(item => item.rowCount);
if (new Set(knotRows).size !== 1 || new Set(truthRows).size !== 1) {
  throw new Error(`Sun/Moon row-count mismatch: knot=${knotRows.join(",")}, truth=${truthRows.join(",")}`);
}
if (knotRows[0] < 365 || truthRows[0] < 364) {
  throw new Error(`Unexpectedly short 4006 grids: knot=${knotRows[0]}, truth=${truthRows[0]}`);
}

const manifest = {
  capturedAt:new Date().toISOString(),
  authority:"NASA/JPL Horizons API",
  purpose:"research-only dense year-4006 recovery of the target-independent Earth ecliptic-of-date rotation and independent half-day interpolation truth",
  contract:{
    observer:"Earth geocenter (500@399)",
    timeScale:"TT",
    referenceSystem:"ICRF",
    quantities:[31,45],
    quantity31:"apparent Earth ecliptic-of-date longitude/latitude",
    quantity45:"inertial ICRF apparent RA/DEC",
    sharedCorrections:"light-time + solar gravitational deflection + stellar aberration",
    frameFitDirections:["sun","moon"],
    knotGrid:"4006 daily 00:00 TT",
    withheldGrid:"4006 daily 12:00 TT"
  },
  records
};
await writeFile(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
