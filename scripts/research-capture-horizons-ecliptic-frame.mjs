import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "tmp/horizons-ecliptic-frame-capture";
const API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";
const REQUEST_DELAY_MS = 1500;

const targets = [
  { id:"10", name:"sun" },
  { id:"499", name:"mars" },
  { id:"599", name:"jupiter" },
  { id:"699", name:"saturn" },
  { id:"999", name:"pluto" }
];

const epochs = [
  { label:"2026-march", jdTt:2461120.0 },
  { label:"2026-june", jdTt:2461212.5 },
  { label:"2026-september", jdTt:2461306.5 },
  { label:"2026-december", jdTt:2461396.0 },
  { label:"4006-march", jdTt:3184300.0 },
  { label:"4006-june", jdTt:3184392.5 },
  { label:"4006-september", jdTt:3184486.5 },
  { label:"4006-december", jdTt:3184576.0 }
];

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
    EPHEM_TYPE:"'OBSERVER'",
    CENTER:"'500@399'",
    TIME_TYPE:"'TT'",
    TLIST_TYPE:"'JD'",
    TLIST:epochs.map(item => `'${item.jdTt}'`).join(" "),
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
for (const [index, target] of targets.entries()) {
  if (index) await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
  const url = requestUrl(target.id);
  console.log(`Capturing ${target.name}...`);
  const response = await fetch(url, { headers:{ "User-Agent":"bazi-time-atlas-research/1.0" } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${target.name}: Horizons HTTP ${response.status}: ${text.slice(0, 500)}`);
  const lines = ephemerisLines(text);
  if (lines.length !== epochs.length) {
    throw new Error(`${target.name}: expected ${epochs.length} ephemeris rows, got ${lines.length}: ${text.slice(-1500)}`);
  }
  if (!/App_Lon_Sun|ObsEcLon/.test(text) || !/ICRF-a-app|ICRF-a-apparnt/.test(text)) {
    throw new Error(`${target.name}: expected quantity #31 and #45 labels were not found`);
  }
  const filename = `${target.name}-q31-q45-tt.txt`;
  await writeFile(path.join(OUTPUT_DIR, filename), text);
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
  purpose:"research-only recovery of the target-independent Earth ecliptic-of-date rotation from paired apparent ICRF (#45) and ecliptic-of-date (#31) directions",
  contract:{
    observer:"Earth geocenter (500@399)",
    timeScale:"TT",
    referenceSystem:"ICRF",
    quantities:[31,45],
    quantity31:"apparent Earth ecliptic-of-date longitude/latitude",
    quantity45:"inertial ICRF apparent RA/DEC",
    sharedCorrections:"light-time + solar gravitational deflection + stellar aberration",
    epochs
  },
  records
};
await writeFile(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
