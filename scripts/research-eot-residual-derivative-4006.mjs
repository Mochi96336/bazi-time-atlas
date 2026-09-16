import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import {
  equationOfTime
} from "../src/astronomy/equation-of-time.js";
import {
  maximumCertifiedLipschitzForContinuousCap
} from "../src/recurrence/equation-of-time-grid-continuity-bound.js";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "tmp/eot-residual-derivative-4006";
const SWISSEPH_EPHE_PATH = process.env.SWISSEPH_EPHE_PATH;
const TARGET_YEAR = 4006;
const STEP_MINUTES = 5;
const STEP_SECONDS = STEP_MINUTES * 60;
const SECONDS_PER_DAY = 86400;
const EXPECTED_INTERIOR_SAMPLES = 105120;
const EXPECTED_SAMPLES_WITH_ENDPOINT = EXPECTED_INTERIOR_SAMPLES + 1;
const EXISTING_EVIDENCE_OBSERVED_MAX_SECONDS = 1.4929317113205443;
const EXISTING_EVIDENCE_COVER_RADIUS_SECONDS = 300;
const RECON_GRID_COVER_RADIUS_SECONDS = 150;
const PLANNING_CONTINUOUS_CAP_SECONDS = 2;
const TOP_WINDOW_LIMIT = 30;

if (!SWISSEPH_EPHE_PATH) throw new Error("SWISSEPH_EPHE_PATH is required");

function isGregorianLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function monthLengths(year) {
  return [31, isGregorianLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
}

function yearSamplesWithTerminalEndpoint(year, stepMinutes) {
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
  samples.push(Object.freeze({
    year:year + 1,
    month:1,
    day:1,
    hour:0,
    minute:0,
    second:0
  }));
  return samples;
}

function runSwissReference(samples) {
  const result = spawnSync(
    "python3",
    ["scripts/research-swiss-eot-derivative-reference.py"],
    {
      input:JSON.stringify(samples),
      encoding:"utf8",
      maxBuffer:256 * 1024 * 1024,
      env:{ ...process.env, SWISSEPH_EPHE_PATH }
    }
  );
  if (result.status !== 0) {
    throw new Error(`Swiss derivative reference helper failed (${result.status}):\n${result.stderr}\n${result.stdout}`);
  }
  const parsed = JSON.parse(result.stdout);
  if (parsed.rows.length !== samples.length) {
    throw new Error(`expected ${samples.length} Swiss rows, got ${parsed.rows.length}`);
  }
  return parsed;
}

function sampleLabel(row) {
  return `${String(row.year).padStart(4, "0")}-${String(row.month).padStart(2, "0")}-${String(row.day).padStart(2, "0")}T${String(row.hour).padStart(2, "0")}:${String(row.minute).padStart(2, "0")}:${String(row.second).padStart(2, "0")}`;
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentileValue * sorted.length) - 1));
  return sorted[index];
}

function summarizeAbsolute(values) {
  const abs = values.map(Math.abs);
  const maxAbs = Math.max(...abs);
  const maxIndex = abs.indexOf(maxAbs);
  return Object.freeze({
    count:values.length,
    maxAbs,
    maxIndex,
    meanAbs:abs.reduce((sum, value) => sum + value, 0) / abs.length,
    p50Abs:percentile(abs, 0.50),
    p95Abs:percentile(abs, 0.95),
    p99Abs:percentile(abs, 0.99),
    p999Abs:percentile(abs, 0.999)
  });
}

function comparisonRecord(row, index) {
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
  return Object.freeze({
    index,
    ...input,
    label:sampleLabel(input),
    julianDayUt:row.julianDayUt,
    swissMinutes:row.equationOfTimeMinutes,
    swissDeltaTSeconds:row.deltaTSeconds,
    alignedMinutes:aligned.minutes,
    productionMinutes:production.minutes,
    alignedErrorSeconds:(aligned.minutes - row.equationOfTimeMinutes) * 60,
    productionErrorSeconds:(production.minutes - row.equationOfTimeMinutes) * 60,
    productionDeltaTSeconds:production.deltaTSeconds
  });
}

function forwardWindows(records, field) {
  const windows = [];
  for (let index = 0; index < records.length - 1; index += 1) {
    const start = records[index];
    const end = records[index + 1];
    const dtSeconds = (end.julianDayUt - start.julianDayUt) * SECONDS_PER_DAY;
    if (Math.abs(dtSeconds - STEP_SECONDS) > 1e-4) {
      throw new Error(`unexpected Swiss UT interval at ${start.label}: ${dtSeconds} s`);
    }
    const deltaResidualSeconds = end[field] - start[field];
    windows.push(Object.freeze({
      index,
      start:start.label,
      end:end.label,
      startResidualSeconds:start[field],
      endResidualSeconds:end[field],
      deltaResidualSeconds,
      intervalSeconds:dtSeconds,
      slopeSecondsPerSecond:deltaResidualSeconds / dtSeconds,
      slopeSecondsPerDay:(deltaResidualSeconds / dtSeconds) * SECONDS_PER_DAY
    }));
  }
  return windows;
}

function centralSlopes(records, field) {
  const slopes = [];
  for (let index = 1; index < records.length - 1; index += 1) {
    const before = records[index - 1];
    const after = records[index + 1];
    const dtSeconds = (after.julianDayUt - before.julianDayUt) * SECONDS_PER_DAY;
    slopes.push(Object.freeze({
      index,
      label:records[index].label,
      slopeSecondsPerSecond:(after[field] - before[field]) / dtSeconds
    }));
  }
  return slopes;
}

function topByAbsoluteSlope(windows, limit = TOP_WINDOW_LIMIT) {
  return [...windows]
    .sort((a, b) => Math.abs(b.slopeSecondsPerSecond) - Math.abs(a.slopeSecondsPerSecond))
    .slice(0, limit);
}

function slopeSummary(records, field) {
  const forward = forwardWindows(records, field);
  const central = centralSlopes(records, field);
  const forwardValues = forward.map(window => window.slopeSecondsPerSecond);
  const centralValues = central.map(window => window.slopeSecondsPerSecond);
  const forwardSummary = summarizeAbsolute(forwardValues);
  const centralSummary = summarizeAbsolute(centralValues);
  const worstForward = forward[forwardSummary.maxIndex];
  const worstCentral = central[centralSummary.maxIndex];
  return Object.freeze({
    forward:Object.freeze({
      ...forwardSummary,
      maxAbsSecondsPerDay:forwardSummary.maxAbs * SECONDS_PER_DAY,
      worst:worstForward,
      topWorst:Object.freeze(topByAbsoluteSlope(forward))
    }),
    central:Object.freeze({
      ...centralSummary,
      maxAbsSecondsPerDay:centralSummary.maxAbs * SECONDS_PER_DAY,
      worst:worstCentral
    })
  });
}

const samples = yearSamplesWithTerminalEndpoint(TARGET_YEAR, STEP_MINUTES);
if (samples.length !== EXPECTED_SAMPLES_WITH_ENDPOINT) {
  throw new Error(`expected ${EXPECTED_SAMPLES_WITH_ENDPOINT} samples including endpoint, got ${samples.length}`);
}
console.log(`Capturing ${samples.length} Swiss samples at ${STEP_MINUTES}-minute cadence including terminal endpoint...`);
const reference = runSwissReference(samples);
const records = reference.rows.map(comparisonRecord);

const interiorRecords = records.slice(0, -1);
const interiorProductionAbs = interiorRecords.map(record => Math.abs(record.productionErrorSeconds));
const interiorObservedMax = Math.max(...interiorProductionAbs);
if (Math.abs(interiorObservedMax - EXISTING_EVIDENCE_OBSERVED_MAX_SECONDS) > 1e-9) {
  throw new Error(
    `corrected dense evidence reproduction mismatch: expected ${EXISTING_EVIDENCE_OBSERVED_MAX_SECONDS}, got ${interiorObservedMax}`
  );
}

const productionSlopes = slopeSummary(records, "productionErrorSeconds");
const alignedSlopes = slopeSummary(records, "alignedErrorSeconds");
const allGridObservedMax = Math.max(...records.map(record => Math.abs(record.productionErrorSeconds)));
const existingTwoSecondThreshold = maximumCertifiedLipschitzForContinuousCap({
  observedMaxAbsErrorSeconds:EXISTING_EVIDENCE_OBSERVED_MAX_SECONDS,
  sampleCoverRadiusSeconds:EXISTING_EVIDENCE_COVER_RADIUS_SECONDS,
  continuousCapSeconds:PLANNING_CONTINUOUS_CAP_SECONDS
});
const endpointGridTwoSecondThreshold = maximumCertifiedLipschitzForContinuousCap({
  observedMaxAbsErrorSeconds:allGridObservedMax,
  sampleCoverRadiusSeconds:RECON_GRID_COVER_RADIUS_SECONDS,
  continuousCapSeconds:PLANNING_CONTINUOUS_CAP_SECONDS
});

const manifest = Object.freeze({
  generatedAt:new Date().toISOString(),
  purpose:"empirical derivative reconnaissance for planning a future certified Equation-of-Time residual continuity proof",
  semantics:Object.freeze({
    empiricalOnly:true,
    certifiedDerivativeBound:false,
    certifiedLipschitzBound:false,
    continuousUpperBound:false,
    mayFeedAuthority:false,
    observedFiniteDifferenceIsNotCertification:true,
    note:"Finite differences over a sampled residual series describe observed local variation only. They do not prove a global derivative or Lipschitz bound between samples."
  }),
  target:Object.freeze({
    year:TARGET_YEAR,
    calendar:"proleptic Gregorian",
    inputTimeScale:"astronomical UT / UT1-oriented independent variable",
    futureUtcPolicyClaim:false
  }),
  reference:Object.freeze({
    library:reference.library,
    version:reference.version,
    equationOfTimeFunction:reference.equationOfTimeFunction,
    deltaTFunction:reference.deltaTFunction,
    signConvention:reference.signConvention,
    ephemerisFlags:reference.ephemerisFlags
  }),
  sampling:Object.freeze({
    cadenceMinutes:STEP_MINUTES,
    cadenceSeconds:STEP_SECONDS,
    interiorSamples:EXPECTED_INTERIOR_SAMPLES,
    terminalEndpointSampled:true,
    totalSamples:records.length,
    intervals:records.length - 1,
    terminalEndpoint:"4007-01-01T00:00:00",
    existingEvidenceCoverRadiusSeconds:EXISTING_EVIDENCE_COVER_RADIUS_SECONDS,
    endpointAugmentedGridCoverRadiusSeconds:RECON_GRID_COVER_RADIUS_SECONDS
  }),
  reproduction:Object.freeze({
    expectedInteriorObservedProductionMaxAbsSeconds:EXISTING_EVIDENCE_OBSERVED_MAX_SECONDS,
    reproducedInteriorObservedProductionMaxAbsSeconds:interiorObservedMax,
    exactWithinTolerance:true,
    toleranceSeconds:1e-9,
    allGridIncludingEndpointObservedProductionMaxAbsSeconds:allGridObservedMax
  }),
  empiricalSlopes:Object.freeze({
    productionResidual:productionSlopes,
    alignedResidual:alignedSlopes
  }),
  planningThresholds:Object.freeze({
    continuousCapSeconds:PLANNING_CONTINUOUS_CAP_SECONDS,
    existingEvidenceGrid:existingTwoSecondThreshold,
    endpointAugmentedGrid:endpointGridTwoSecondThreshold,
    observedForwardSlopeToExistingThresholdRatio:
      productionSlopes.forward.maxAbs / existingTwoSecondThreshold.maximumLipschitzSecondsPerSecond,
    thresholdComparisonIsCertification:false
  })
});

const worstForwardSlopes = Object.freeze({
  semantics:Object.freeze({
    empiricalOnly:true,
    certification:false
  }),
  productionResidual:productionSlopes.forward.topWorst,
  alignedResidual:alignedSlopes.forward.topWorst
});

await mkdir(OUTPUT_DIR, { recursive:true });
await Promise.all([
  writeFile(`${OUTPUT_DIR}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`),
  writeFile(
    `${OUTPUT_DIR}/residual-series.ndjson`,
    `${records.map(record => JSON.stringify(record)).join("\n")}\n`
  ),
  writeFile(
    `${OUTPUT_DIR}/worst-forward-slopes.json`,
    `${JSON.stringify(worstForwardSlopes, null, 2)}\n`
  )
]);

console.log(JSON.stringify(manifest, null, 2));
