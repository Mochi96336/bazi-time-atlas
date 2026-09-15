import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { equationOfTime } from "../src/astronomy/equation-of-time.js";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "tmp/eot-swiss-4006";
const SWISSEPH_EPHE_PATH = process.env.SWISSEPH_EPHE_PATH;
const YEARS = Object.freeze([2026, 4006]);
const HOURLY_STEP_MINUTES = 60;
const DENSE_YEAR = 4006;
const DENSE_STEP_MINUTES = 5;
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

function samplesForYear(year, stepMinutes) {
  if (!Number.isInteger(stepMinutes) || stepMinutes <= 0 || 1440 % stepMinutes !== 0) {
    throw new RangeError("stepMinutes must be a positive integer divisor of 1440");
  }
  const samples = [];
  for (const [monthIndex, days] of monthLengths(year).entries()) {
    const month = monthIndex + 1;
    for (let day = 1; day <= days; day += 1) {
      for (let minuteOfDay = 0; minuteOfDay < 1440; minuteOfDay += stepMinutes) {
        samples.push(Object.freeze({
          year,
          month,
          day,
          hour:Math.floor(minuteOfDay / 60),
          minute:minuteOfDay % 60,
          second:0
        }));
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
  const worstRecord = records[maxAbsIndex];
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
      year:worstRecord.year,
      month:worstRecord.month,
      day:worstRecord.day,
      hour:worstRecord.hour,
      minute:worstRecord.minute,
      second:worstRecord.second,
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
      minute:record.minute,
      second:record.second,
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

function runSwissReference(samples, label) {
  console.log(`Capturing Swiss reference for ${label}: ${samples.length} samples...`);
  const python = spawnSync(
    "python3",
    ["scripts/research-swiss-eot-reference.py"],
    {
      input:JSON.stringify(samples),
      encoding:"utf8",
      maxBuffer:128 * 1024 * 1024,
      env:{ ...process.env, SWISSEPH_EPHE_PATH }
    }
  );
  if (python.status !== 0) {
    throw new Error(`Swiss reference helper failed for ${label} (${python.status}):\n${python.stderr}\n${python.stdout}`);
  }
  const reference = JSON.parse(python.stdout);
  if (reference.rows.length !== samples.length) {
    throw new Error(`${label}: expected ${samples.length} Swiss rows, got ${reference.rows.length}`);
  }
  return reference;
}

function comparisonRecord(row) {
  const input = {
    year:row.year,
    month:row.month,
    day:row.day,
    hour:row.hour,
    minute:row.minute ?? 0,
    second:row.second ?? 0
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
}

function comparisonSummary(records) {
  return Object.freeze({
    samples:records.length,
    alignedErrorSeconds:summarize(records, "alignedErrorSeconds"),
    productionErrorSeconds:summarize(records, "productionErrorSeconds"),
    deltaTSecondsDifference:summarize(records, "deltaTSecondsDifference"),
    deltaTDrivenEotDifferenceSeconds:summarize(records, "deltaTDrivenEotDifferenceSeconds"),
    worstAligned:topWorst(records, "alignedErrorSeconds"),
    worstProduction:topWorst(records, "productionErrorSeconds")
  });
}

const hourlySamples = YEARS.flatMap(year => samplesForYear(year, HOURLY_STEP_MINUTES));
console.log(`Comparing ${hourlySamples.length} hourly proleptic-Gregorian UT arguments across ${YEARS.join(" and ")}...`);
const hourlyReference = runSwissReference(hourlySamples, "hourly 2026+4006");
const hourlyRecords = hourlyReference.rows.map(comparisonRecord);
const hourlyByYear = Object.fromEntries(YEARS.map(year => [
  year,
  comparisonSummary(hourlyRecords.filter(record => record.year === year))
]));

const denseSamples = samplesForYear(DENSE_YEAR, DENSE_STEP_MINUTES);
console.log(`Running dense ${DENSE_STEP_MINUTES}-minute sweep for ${DENSE_YEAR}: ${denseSamples.length} samples...`);
const denseReference = runSwissReference(denseSamples, `dense ${DENSE_YEAR}`);
const denseRecords = denseReference.rows.map(comparisonRecord);
const denseSummary = comparisonSummary(denseRecords);

const referenceIdentity = Object.freeze({
  library:hourlyReference.library,
  version:hourlyReference.version,
  function:hourlyReference.equationOfTimeFunction,
  signConvention:hourlyReference.signConvention,
  inputTimeScale:hourlyReference.inputTimeScale,
  ephemerisFlags:Object.freeze(Array.from(new Set([
    ...hourlyReference.ephemerisFlags,
    ...denseReference.ephemerisFlags
  ])).sort((a, b) => a - b))
});

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
    ...referenceIdentity,
    timeInterpretation:"Swiss Ephemeris astronomical UT argument; used here as a UT1-oriented independent variable, not as a claim about year-4006 UTC, leap seconds, EOP predictions, DST, or political civil time",
    ephemerisFiles:Object.freeze(ephemerisFiles)
  }),
  sampling:Object.freeze({
    calendar:"proleptic Gregorian",
    timeArgument:"astronomical UT-like argument at zero longitude",
    futureUtcPolicyClaim:false,
    hourly:Object.freeze({
      years:YEARS,
      cadenceMinutes:HOURLY_STEP_MINUTES,
      totalSamples:hourlyRecords.length,
      samplesPerYear:Object.fromEntries(YEARS.map(year => [year, hourlyRecords.filter(record => record.year === year).length]))
    }),
    dense:Object.freeze({
      year:DENSE_YEAR,
      cadenceMinutes:DENSE_STEP_MINUTES,
      totalSamples:denseRecords.length,
      retainsFullRecords:false
    })
  }),
  comparisonModes:Object.freeze({
    aligned:"production equationOfTime() with Swiss Ephemeris delta-T injected, isolating EoT/solar-position model disagreement at matched ephemeris time",
    production:"production equationOfTime() unchanged, including the repository Tyme/ShouXing delta-T model"
  }),
  summary:Object.freeze({
    hourly:Object.freeze(hourlyByYear),
    dense4006:denseSummary
  })
});

await mkdir(OUTPUT_DIR, { recursive:true });
await writeFile(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(
  path.join(OUTPUT_DIR, "records-hourly.ndjson"),
  `${hourlyRecords.map(record => JSON.stringify(record)).join("\n")}\n`
);

console.log(JSON.stringify(manifest, null, 2));
