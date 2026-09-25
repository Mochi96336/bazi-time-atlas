import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import {
  DE441_SEASONAL_CHUNK_FORMAT,
  canonicalEpochsFromSeasonalEvents,
  decodeDe441SeasonalEpochChunk,
  encodeDe441SeasonalEpochChunk
} from "../src/astronomy/de441-seasonal-event-chunk.js";

const REQUIRED_REFERENCE_SEMANTICS =
  "geocentric-apparent-solar-longitude-mean-ecliptic-of-date";

function usage() {
  throw new Error(
    "usage: node scripts/build-de441-seasonal-chunk.mjs <input.json> <output.bin> <manifest.json>"
  );
}

const [inputPath, outputPath, manifestPath] = process.argv.slice(2);
if (!inputPath || !outputPath || !manifestPath) usage();

const input = JSON.parse(readFileSync(inputPath, "utf8"));
if (input.sourceEphemeris !== "DE441") throw new Error("input sourceEphemeris must be DE441");
if (input.timeScale !== "TT") throw new Error("input timeScale must be TT");
if (input.referenceSemantics !== REQUIRED_REFERENCE_SEMANTICS) {
  throw new Error("input referenceSemantics does not match the seasonal range contract");
}
if (!Array.isArray(input.evidenceIds) || input.evidenceIds.length < 1) {
  throw new Error("input must pin at least one evidence id");
}
if (!Array.isArray(input.years) || input.years.length < 1) {
  throw new Error("input must contain at least one catalogue year");
}

const sortedYears = [...input.years].sort((left, right) => left.year - right.year);
const minYear = sortedYears[0]?.year;
if (!Number.isInteger(minYear)) throw new Error("input catalogue years must be integers");

const rows = sortedYears.map((entry, index) => {
  const expectedYear = minYear + index;
  if (entry.year !== expectedYear) {
    throw new Error(`input catalogue years must be contiguous; expected ${expectedYear}, got ${entry.year}`);
  }
  return Object.freeze({
    year:entry.year,
    epochs:canonicalEpochsFromSeasonalEvents(entry.events)
  });
});

const bytes = encodeDe441SeasonalEpochChunk({ minYear, years:rows });
const decoded = decodeDe441SeasonalEpochChunk(bytes);
const payloadSha256 = createHash("sha256").update(bytes).digest("hex");

const manifest = Object.freeze({
  schemaVersion:1,
  id:input.id ?? `de441-seasonal-${decoded.minYear}-${decoded.maxYear}`,
  encoding:DE441_SEASONAL_CHUNK_FORMAT.id,
  chunkSchemaVersion:DE441_SEASONAL_CHUNK_FORMAT.schemaVersion,
  sourceEphemeris:"DE441",
  referenceSemantics:REQUIRED_REFERENCE_SEMANTICS,
  timeScale:"TT",
  yearBasis:DE441_SEASONAL_CHUNK_FORMAT.yearBasis,
  minYear:decoded.minYear,
  maxYear:decoded.maxYear,
  yearCount:decoded.yearCount,
  eventsPerYear:decoded.eventsPerYear,
  longitudeStepDegrees:decoded.longitudeStepDegrees,
  byteLength:decoded.byteLength,
  payloadSha256,
  evidenceIds:Object.freeze([...input.evidenceIds]),
  claimClass:input.claimClass ?? "de441-derived",
  productionAuthorityGranted:input.productionAuthorityGranted === true,
  independentTargetYearTruth:input.independentTargetYearTruth === true
});

writeFileSync(outputPath, bytes);
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(JSON.stringify({
  id:manifest.id,
  minYear:manifest.minYear,
  maxYear:manifest.maxYear,
  yearCount:manifest.yearCount,
  byteLength:manifest.byteLength,
  payloadSha256:manifest.payloadSha256,
  claimClass:manifest.claimClass,
  productionAuthorityGranted:manifest.productionAuthorityGranted
}, null, 2));
