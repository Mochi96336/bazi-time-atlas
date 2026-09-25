import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  seasonalEventsForCatalogueYear
} from "../src/astronomy/de441-seasonal-event-data-product.js";
import {
  DE441_SEASONAL_CHUNK_FORMAT,
  decodeDe441SeasonalEpochChunk
} from "../src/astronomy/de441-seasonal-event-chunk.js";

const REFERENCE_SEMANTICS =
  "geocentric-apparent-solar-longitude-mean-ecliptic-of-date";

test("offline chunk builder emits deterministic binary data plus a pinned SHA-256 manifest", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bta-de441-chunk-"));
  try {
    const inputPath = join(dir, "input.json");
    const outputPath = join(dir, "seasonal.bin");
    const manifestPath = join(dir, "seasonal.manifest.json");
    const input = {
      id:"de441-seasonal-4006-test",
      sourceEphemeris:"DE441",
      referenceSemantics:REFERENCE_SEMANTICS,
      timeScale:"TT",
      evidenceIds:["jpl-horizons-de441-4006-seasonal-events-source-v1"],
      claimClass:"authoritative-source-pinned",
      productionAuthorityGranted:true,
      independentTargetYearTruth:true,
      years:[{
        year:4006,
        events:seasonalEventsForCatalogueYear(4006).map(event => ({
          longitudeDegrees:event.longitudeDegrees,
          ttJulianDay:event.ttJulianDay
        }))
      }]
    };
    await writeFile(inputPath, JSON.stringify(input));

    const run = spawnSync(process.execPath, [
      "scripts/build-de441-seasonal-chunk.mjs",
      inputPath,
      outputPath,
      manifestPath
    ], {
      cwd:new URL("..", import.meta.url),
      encoding:"utf8"
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);

    const bytes = new Uint8Array(await readFile(outputPath));
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const digest = createHash("sha256").update(bytes).digest("hex");
    const decoded = decodeDe441SeasonalEpochChunk(bytes);

    assert.equal(manifest.encoding, DE441_SEASONAL_CHUNK_FORMAT.id);
    assert.equal(manifest.minYear, 4006);
    assert.equal(manifest.maxYear, 4006);
    assert.equal(manifest.yearCount, 1);
    assert.equal(manifest.payloadSha256, digest);
    assert.equal(manifest.byteLength, bytes.byteLength);
    assert.deepEqual(manifest.evidenceIds, ["jpl-horizons-de441-4006-seasonal-events-source-v1"]);
    assert.equal(manifest.productionAuthorityGranted, true);
    assert.equal(manifest.independentTargetYearTruth, true);
    assert.equal(
      decoded.ttJulianDayFor({ year:4006, longitudeDegrees:315 }),
      seasonalEventsForCatalogueYear(4006).find(event => event.longitudeDegrees === 315).ttJulianDay
    );
  } finally {
    await rm(dir, { recursive:true, force:true });
  }
});

test("offline chunk builder refuses sparse catalogue-year input", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bta-de441-chunk-gap-"));
  try {
    const inputPath = join(dir, "input.json");
    const outputPath = join(dir, "seasonal.bin");
    const manifestPath = join(dir, "seasonal.manifest.json");
    const events = seasonalEventsForCatalogueYear(4006).map(event => ({
      longitudeDegrees:event.longitudeDegrees,
      ttJulianDay:event.ttJulianDay
    }));
    await writeFile(inputPath, JSON.stringify({
      sourceEphemeris:"DE441",
      referenceSemantics:REFERENCE_SEMANTICS,
      timeScale:"TT",
      evidenceIds:["proof"],
      years:[
        { year:4006, events },
        { year:4008, events }
      ]
    }));

    const run = spawnSync(process.execPath, [
      "scripts/build-de441-seasonal-chunk.mjs",
      inputPath,
      outputPath,
      manifestPath
    ], {
      cwd:new URL("..", import.meta.url),
      encoding:"utf8"
    });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /contiguous/);
  } finally {
    await rm(dir, { recursive:true, force:true });
  }
});
