import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { equationOfTime } from "../src/astronomy/equation-of-time.js";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "tmp/eot-swiss-4006";
const SWISSEPH_EPHE_PATH = process.env.SWISSEPH_EPHE_PATH;
const YEARS = Object.freeze([2026, 4006]);
const HOURS_PER_DAY = 24;
const EXPECTED_EPHEMERIS_FILES = Object.freeze([
  Object.freeze({ year:2026, bodyClass:"planetary", filename:"sepl_18.se1", coverage:"1800-2399 CE" }),
  Object.freeze({ year:2026, bodyClass:"lunar", filename:"semo_18.se1", coverage:"1800-2399 CE" }),
  Object.freeze({ year:4006, bodyClass:"planetary", filename:"sepl_36.se1", coverage:"3600-4199 CE" }),
  Object.freeze({ year:4006, bodyClass:"lunar", filename:"semo_36.se1", coverage:"3600-4199 CE" })
]);

if (!SWISSEPH_EPHE_PATH) throw new Error("SWISSEPH_EPHE_PATH is required");

function isGregorianLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function monthLengths(year) {
  return [31, isGregorianLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
}

function samplesForYear(year) {
  const samples = [];
  for (const [monthIndex, days] of monthLengths(year).entries()) {
    const month = monthIndex + 1;
    for (let day = 1; day <= days; day += 1) {
      for (let hour = 0; hour < HOURS_PER_DAY; hour += 1) {
        samples.push(Object.freeze({ year, month, day, hour }));
      }
    }
  }
  return samples;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function absPercentile(values, percentile) {
  const sorted = values.map(Math.abs).sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(percentile * sorted.length) - 1);
  return sorted[index];
}

function summarize(records, field) {
  const values = records.map(record => record[field]);
  const absValues = values.map(Math.abs);
  const maxAbs = Math.max(...absValues);
  const maxAbsIndex = absValues.indexOf(maxAbs);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const rms = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
  return Object.freeze({
    count:values.length,
    min:Math.min(...values),
    max:Math.max(...values),
    mean,
    rms,
    maxAbs,
    p95Abs:absPercentile(values, 0.95),
    p99Abs:absPercentile(values, 0.99),
    worst:Object.freeze({
      year:records[maxAbsIndex].year,
      month:records[maxAbsIndex].month,
      day:records[maxAbsIndex].day,
      hour:records[maxAbsIndex].hour,
      value:values[maxAbsIndex]
    })
  });
}

function topWorst(records, field, limit = 20) {
  return records
    .map(record => ({
      year:record.year,
      month:record.month,
      day:record.day,
      hour:record.hour,
      swissMinutes:record.swissMinutes,
      alignedMinutes:record.alignedMinutes,
      productionMinutes:record.productionMinutes,
      swissDeltaTSeconds:record.swissDeltaTSeconds,
      productionDeltaTSeconds:record.productionDeltaTSeconds,
      [field]:record[field]
    }))
    .sort((a, b) => Math.abs(b[field]) - Math.abs(a[field]))
    .slice(0, limit)
    .map(Object.freeze);
}

const samples = YEARS.flatMap(samplesForYear);
console.log(`Comparing ${samples.length} hourly samples across ${YEARS.join(" and ")}...`);

const python = spawnSync(
  "python3",
  ["scripts/research-swiss-eot-reference.py"],
  {
    input:JSON.stringify(samples),
    encoding:"utf8",
    maxBuffer:64 * 1024 * 1024,
    env:{ ...process.env, SWISSEPH_EPHE_PATH }
  }
);
if (python.status !== 0) {
  throw new Error(`Swiss reference helper failed (${python.status}):\n${python.stderr}\n${python.stdout}`);
}
const reference = JSON.parse(python.stdout);
if (reference.rows.length !== samples.length) {
  throw new Error(`Swiss reference row mismatch: expected ${samples.length}, got ${reference.rows.length}`);
}

const records = reference.rows.map(row => {
  const input = {
    year:row.year,
    month:row.month,
    day:row.day,
    hour:row.hour,
    minute:0,
    second:0
  };
  const aligned = equationOfTime(input, 0, { deltaTSeconds:row.deltaTSeconds });
  const production = equationOfTime(input, 0);
  const alignedErrorSeconds = (aligned.minutes - row.equationOfTimeMinutes) * 60;
  const productionErrorSeconds = (production.minutes - row.equationOfTimeMinutes) * 60;
  const deltaTDrivenEotDifferenceSeconds = (production.minutes - aligned.minutes) * 60;
  return Object.freeze({
    ...input,
    julianDayUt:row.julianDayUt,
    swissMinutes:row.equationOfTimeMinutes,
    swissDeltaTSeconds:row.deltaTSeconds,
    alignedMinutes:aligned.minutes,
    alignedDeltaTSeconds:aligned.deltaTSeconds,
    productionMinutes:production.minutes,
    productionDeltaTSeconds:production.deltaTSeconds,
    alignedErrorSeconds,
    productionErrorSeconds,
    deltaTSecondsDifference:production.deltaTSeconds - row.deltaTSeconds,
    deltaTDrivenEotDifferenceSeconds
  });
});

const byYear = Object.fromEntries(YEARS.map(year => {
  const yearRecords = records.filter(record => record.year === year);
  return [year, Object.freeze({
    samples:yearRecords.length,
    alignedErrorSeconds:summarize(yearRecords, "alignedErrorSeconds"),
    productionErrorSeconds:summarize(yearRecords, "productionErrorSeconds"),
    deltaTSecondsDifference:summarize(yearRecords, "deltaTSecondsDifference"),
    deltaTDrivenEotDifferenceSeconds:summarize(yearRecords, "deltaTDrivenEotDifferenceSeconds"),
    worstAligned:topWorst(yearRecords, "alignedErrorSeconds"),
    worstProduction:topWorst(yearRecords, "productionErrorSeconds")
  })];
}));

const ephemerisFiles = [];
for (const expected of EXPECTED_EPHEMERIS_FILES) {
  const filePath = path.join(SWISSEPH_EPHE_PATH, expected.filename);
  const [buffer, info] = await Promise.all([readFile(filePath), stat(filePath)]);
  ephemerisFiles.push(Object.freeze({
    ...expected,
    bytes:info.size,
    sha256:sha256(buffer)
  }));
}

const manifest = Object.freeze({
  generatedAt:new Date().toISOString(),
  purpose:"research-only independent Equation-of-Time comparison before granting recurrence target-era authority",
  production:Object.freeze({
    implementation:"src/astronomy/equation-of-time.js",
    method:"tyme-apparent-sun+nrel-spa-a1",
    signConvention:"apparent-solar-time-minus-mean-solar-time"
  }),
  reference:Object.freeze({
    library:reference.library,
    version:reference.version,
    function:reference.equationOfTimeFunction,
    signConvention:reference.signConvention,
    inputTimeScale:reference.inputTimeScale,
    ephemerisFlags:reference.ephemerisFlags,
    ephemerisFiles:Object.freeze(ephemerisFiles)
  }),
  sampling:Object.freeze({
    calendar:"proleptic Gregorian",
    years:YEARS,
    cadence:"1 hour",
    utcOffsetHours:0,
    totalSamples:records.length,
    samplesPerYear:Object.fromEntries(YEARS.map(year => [year, records.filter(record => record.year === year).length]))
  }),
  comparisonModes:Object.freeze({
    aligned:"production equationOfTime() with Swiss Ephemeris delta-T injected, isolating EoT/solar-position model disagreement at matched ephemeris time",
    production:"production equationOfTime() unchanged, including the repository Tyme/ShouXing delta-T model"
  }),
  summary:Object.freeze(byYear)
});

await mkdir(OUTPUT_DIR, { recursive:true });
await writeFile(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(
  path.join(OUTPUT_DIR, "records.ndjson"),
  `${records.map(record => JSON.stringify(record)).join("\n")}\n`
);

console.log(JSON.stringify(manifest, null, 2));
