import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "tmp/horizons-ecliptic-frame-capture";
const API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";
const REQUEST_DELAY_MS = 1500;

const targets = [
  { id:"10", name:"sun" },
  { id:"301", name:"moon" },
  { id:"499", name:"mars" },
  { id:"599", name:"jupiter" },
  { id:"699", name:"saturn" },
  { id:"999", name:"pluto" }
];

const epochGroups = Object.freeze({
  2026:Object.freeze([
    { label:"2026-march", jdTt:2461120.0 },
    { label:"2026-june", jdTt:2461212.5 },
    { label:"2026-september", jdTt:2461306.5 },
    { label:"2026-december", jdTt:2461396.0 }
  ]),
  4006:Object.freeze([
    { label:"4006-march", jdTt:3184300.0 },
    { label:"4006-june", jdTt:3184392.5 },
    { label:"4006-september", jdTt:3184486.5 },
    { label:"4006-december", jdTt:3184576.0 }
  ])
});

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function requestUrl(targetId, epochs) {
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

function compactLimitation(text) {
  return text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !line.startsWith("API VERSION") && !line.startsWith("API SOURCE"))
    .slice(-8)
    .join(" ")
    .slice(0, 1200);
}

await mkdir(OUTPUT_DIR, { recursive:true });
const records = [];
let requestIndex = 0;
for (const target of targets) {
  for (const [yearText, epochs] of Object.entries(epochGroups)) {
    if (requestIndex++) await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
    const year = Number(yearText);
    const url = requestUrl(target.id, epochs);
    console.log(`Capturing ${target.name} ${year}...`);
    const response = await fetch(url, { headers:{ "User-Agent":"bazi-time-atlas-research/1.0" } });
    const text = await response.text();
    const lines = ephemerisLines(text);
    const labelsPresent = /App_Lon_Sun|ObsEcLon/.test(text)
      && /ICRF-a-app|ICRF-a-apparnt/.test(text);
    const available = response.ok && lines.length === epochs.length && labelsPresent;
    const filename = `${target.name}-${year}-q31-q45-tt.txt`;
    await writeFile(path.join(OUTPUT_DIR, filename), text);
    records.push({
      ...target,
      year,
      filename,
      requestUrl:url.toString(),
      httpStatus:response.status,
      available,
      labelsPresent,
      bytes:Buffer.byteLength(text),
      sha256:sha256(text),
      expectedRowCount:epochs.length,
      rowCount:lines.length,
      ephemerisLines:lines,
      limitation:available ? null : compactLimitation(text)
    });
  }
}

const available2026 = records.filter(item => item.year === 2026 && item.available);
const sun4006 = records.find(item => item.name === "sun" && item.year === 4006);
if (available2026.length < 4) {
  throw new Error(`expected at least four independent 2026 targets, got ${available2026.length}`);
}
if (!sun4006?.available) {
  throw new Error(`Sun 4006 quantity #31/#45 reference is unavailable: ${sun4006?.limitation || "missing record"}`);
}

const manifest = {
  capturedAt:new Date().toISOString(),
  authority:"NASA/JPL Horizons API",
  purpose:"research-only recovery of the Earth ecliptic-of-date rotation from paired apparent ICRF (#45) and ecliptic-of-date (#31) directions, while preserving target-range limitations as evidence",
  contract:{
    observer:"Earth geocenter (500@399)",
    timeScale:"TT",
    referenceSystem:"ICRF",
    quantities:[31,45],
    quantity31:"apparent Earth ecliptic-of-date longitude/latitude",
    quantity45:"inertial ICRF apparent RA/DEC",
    sharedCorrections:"light-time + solar gravitational deflection + stellar aberration",
    epochGroups
  },
  availabilitySummary:{
    available2026Targets:available2026.map(item => item.name),
    available4006Targets:records.filter(item => item.year === 4006 && item.available).map(item => item.name),
    unavailable4006Targets:records.filter(item => item.year === 4006 && !item.available)
      .map(item => ({ name:item.name, limitation:item.limitation }))
  },
  records
};
await writeFile(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
