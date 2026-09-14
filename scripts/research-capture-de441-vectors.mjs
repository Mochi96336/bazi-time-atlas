import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "tmp/de441-state-capture";
const API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";
const REQUEST_DELAY_MS = 1500;

const captures = [
  { body:"earth", command:"399", catalogueYear:2026, samplePhase:"daily-grid", start:"2025-12-01", stop:"2026-12-31" },
  { body:"sun", command:"10", catalogueYear:2026, samplePhase:"daily-grid", start:"2025-12-01", stop:"2026-12-31" },
  { body:"earth", command:"399", catalogueYear:4006, samplePhase:"daily-grid", start:"4005-12-01", stop:"4006-12-31" },
  { body:"sun", command:"10", catalogueYear:4006, samplePhase:"daily-grid", start:"4005-12-01", stop:"4006-12-31" },
  // These half-day-shifted rows are withheld from interpolation input and are
  // used only to measure the error of one-day cubic Hermite state segments.
  { body:"earth", command:"399", catalogueYear:2026, samplePhase:"withheld-midpoint", start:"2025-12-01 12:00", stop:"2026-12-30 12:00" },
  { body:"sun", command:"10", catalogueYear:2026, samplePhase:"withheld-midpoint", start:"2025-12-01 12:00", stop:"2026-12-30 12:00" },
  { body:"earth", command:"399", catalogueYear:4006, samplePhase:"withheld-midpoint", start:"4005-12-01 12:00", stop:"4006-12-30 12:00" },
  { body:"sun", command:"10", catalogueYear:4006, samplePhase:"withheld-midpoint", start:"4005-12-01 12:00", stop:"4006-12-30 12:00" }
];

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function countEphemerisRows(text) {
  const start = text.indexOf("$$SOE");
  const end = text.indexOf("$$EOE");
  if (start < 0 || end <= start) return 0;
  return text.slice(start + 5, end)
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0).length;
}

function requestUrl({ command, start, stop }) {
  const url = new URL(API_URL);
  const params = {
    format:"text",
    COMMAND:`'${command}'`,
    OBJ_DATA:"'NO'",
    MAKE_EPHEM:"'YES'",
    EPHEM_TYPE:"'VECTORS'",
    CENTER:"'500@0'",
    START_TIME:`'${start}'`,
    STOP_TIME:`'${stop}'`,
    STEP_SIZE:"'1 d'",
    TIME_TYPE:"'TDB'",
    REF_PLANE:"'FRAME'",
    REF_SYSTEM:"'ICRF'",
    OUT_UNITS:"'AU-D'",
    VEC_TABLE:"'2'",
    VEC_CORR:"'NONE'",
    VEC_LABELS:"'YES'",
    CSV_FORMAT:"'YES'",
    TIME_DIGITS:"'FRACSEC'"
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

async function captureOne(spec) {
  const url = requestUrl(spec);
  const response = await fetch(url, {
    headers:{ "User-Agent":"bazi-time-atlas-research/1.0" }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${spec.body}-${spec.catalogueYear}-${spec.samplePhase}: Horizons HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  if (!text.includes("$$SOE") || !text.includes("$$EOE")) {
    throw new Error(`${spec.body}-${spec.catalogueYear}-${spec.samplePhase}: Horizons response has no ephemeris block`);
  }
  const rowCount = countEphemerisRows(text);
  if (rowCount < 350) {
    throw new Error(`${spec.body}-${spec.catalogueYear}-${spec.samplePhase}: expected a catalogue-year capture, got ${rowCount} rows`);
  }

  const filename = `${spec.body}-${spec.catalogueYear}-${spec.samplePhase}-icrf-tdb-au-d.txt`;
  await writeFile(path.join(OUTPUT_DIR, filename), text);
  return {
    ...spec,
    filename,
    requestUrl:url.toString(),
    httpStatus:response.status,
    bytes:Buffer.byteLength(text),
    sha256:sha256(text),
    rowCount,
    mentionsDe441:/DE[- ]?441/i.test(text),
    sourceHeaders:text.split(/\r?\n/).filter(line => /source|ephemeris|DE[- ]?44/i.test(line)).slice(0, 20)
  };
}

await mkdir(OUTPUT_DIR, { recursive:true });
const records = [];
for (const [index, spec] of captures.entries()) {
  if (index) await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
  console.log(`Capturing ${spec.body} ${spec.catalogueYear} ${spec.samplePhase}...`);
  records.push(await captureOne(spec));
}

const manifest = {
  capturedAt:new Date().toISOString(),
  authority:"NASA/JPL Horizons API",
  apiUrl:API_URL,
  purpose:"research-only DE441 state-vector capture; not a production network dependency",
  vectorContract:{
    center:"Solar System barycenter (500@0)",
    referenceFrame:"ICRF",
    timeScale:"TDB",
    units:"AU-D",
    corrections:"NONE (geometric)",
    table:"2 (position + velocity)",
    cadence:"1 day",
    validation:"half-day shifted withheld truth for Hermite interpolation"
  },
  records
};
await writeFile(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify(manifest, null, 2));
