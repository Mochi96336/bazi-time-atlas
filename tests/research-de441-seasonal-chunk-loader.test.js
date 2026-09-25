import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  RESEARCH_DE441_SEASONAL_CHUNK_LOADER_CONTRACT,
  verifyResearchDe441SeasonalChunk
} from "../src/recurrence/research-de441-seasonal-chunk-loader.js";
import { DE441_10026_SEASONAL_CROSSING_EVIDENCE } from "../src/astronomy/de441-10026-seasonal-crossing-evidence.js";
import {
  assessDe441SeasonalRangePromotion
} from "../src/recurrence/de441-seasonal-range-promotion.js";

const ASSET = new URL("../assets/research/de441-seasonal/10026.bin", import.meta.url);
const MANIFEST = new URL("../assets/research/de441-seasonal/10026.manifest.json", import.meta.url);

test("year-10026 binary Research chunk verifies its pinned SHA-256 before decode", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  const bytes = new Uint8Array(await readFile(ASSET));
  const loaded = await verifyResearchDe441SeasonalChunk({ manifest, bytes });

  assert.equal(loaded.payloadIntegrityVerified, true);
  assert.equal(loaded.payloadSha256, manifest.payloadSha256);
  assert.equal(loaded.minYear, 10026);
  assert.equal(loaded.maxYear, 10026);
  assert.equal(loaded.productionAuthorityGranted, false);
  assert.equal(loaded.independentTargetYearTruth, false);
  assert.deepEqual(loaded.evidenceIds, [DE441_10026_SEASONAL_CROSSING_EVIDENCE.id]);
  assert.equal(
    loaded.chunk.ttJulianDayFor({ year:10026, longitudeDegrees:315 }),
    DE441_10026_SEASONAL_CROSSING_EVIDENCE.liChun.ttJulianDay
  );

  assert.equal(loaded.chunk.eventsPerYear, 24);
  assert.equal(loaded.chunk.longitudeStepDegrees, 15);
  assert.equal(
    DE441_10026_SEASONAL_CROSSING_EVIDENCE.compactRuntimeAsset.payloadSha256,
    loaded.payloadSha256
  );
  assert.equal(
    DE441_10026_SEASONAL_CROSSING_EVIDENCE.compactRuntimeAsset.runtimeDataCopy,
    "compact-binary-only"
  );
});

test("verified 10026 binary is Research-load eligible but cannot cross the production promotion boundary", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  const bytes = new Uint8Array(await readFile(ASSET));
  const loaded = await verifyResearchDe441SeasonalChunk({ manifest, bytes });
  const result = assessDe441SeasonalRangePromotion({
    minYear:loaded.minYear,
    maxYear:loaded.maxYear,
    sourceCoverage:{ minYear:-13_200, maxYear:17_191 },
    chunks:[{
      id:loaded.id,
      minYear:loaded.minYear,
      maxYear:loaded.maxYear,
      encoding:loaded.manifest.encoding,
      schemaVersion:loaded.manifest.chunkSchemaVersion,
      sourceEphemeris:loaded.sourceEphemeris,
      timeScale:loaded.timeScale,
      referenceSemantics:loaded.referenceSemantics,
      payloadSha256:loaded.payloadSha256,
      payloadIntegrityVerified:loaded.payloadIntegrityVerified,
      byteLength:bytes.byteLength,
      evidenceIds:loaded.evidenceIds
    }],
    validationSamples:[{
      year:10026,
      sourceEphemeris:"DE441",
      timeScale:"TT",
      referenceSemantics:loaded.referenceSemantics,
      canonicalCrossings:24,
      sourceAuthenticityVerified:true,
      frameAndTimeScaleValidated:false,
      solverParityValidated:true,
      crossingResidualsValidated:true,
      independentImplementationValidated:false,
      independentTargetYearTruth:false
    }]
  });

  assert.equal(result.researchLoadEligible, true);
  assert.equal(result.productionPromotionEligible, false);
  assert.equal(result.status, "independent-validation-incomplete");
  assert.equal(result.blocker, "independent-target-era-validation");
});

test("Research binary loader fails closed on one-byte payload tampering", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  const bytes = new Uint8Array(await readFile(ASSET));
  const tampered = Uint8Array.from(bytes);
  tampered[tampered.length - 1] ^= 0x01;

  await assert.rejects(
    () => verifyResearchDe441SeasonalChunk({ manifest, bytes:tampered }),
    /SHA-256 mismatch/
  );
});

test("Research binary loader fails closed if manifest attempts to claim production authority", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  const bytes = new Uint8Array(await readFile(ASSET));

  await assert.rejects(
    () => verifyResearchDe441SeasonalChunk({
      manifest:{ ...manifest, productionAuthorityGranted:true },
      bytes
    }),
    /production-authority-boundary/
  );
});

test("Research chunk loader contract keeps binary loading outside production authority", () => {
  assert.equal(RESEARCH_DE441_SEASONAL_CHUNK_LOADER_CONTRACT.digest, "SHA-256");
  assert.equal(RESEARCH_DE441_SEASONAL_CHUNK_LOADER_CONTRACT.integrityRequiredBeforeDecode, true);
  assert.equal(RESEARCH_DE441_SEASONAL_CHUNK_LOADER_CONTRACT.productionAuthorityGranted, false);
  assert.equal(RESEARCH_DE441_SEASONAL_CHUNK_LOADER_CONTRACT.independentTargetYearTruth, false);
  assert.equal(RESEARCH_DE441_SEASONAL_CHUNK_LOADER_CONTRACT.asynchronousAssetLoad, true);
});
