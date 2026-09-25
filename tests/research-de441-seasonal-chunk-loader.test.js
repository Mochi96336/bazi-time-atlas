import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  RESEARCH_DE441_SEASONAL_CHUNK_LOADER_CONTRACT,
  verifyResearchDe441SeasonalChunk
} from "../src/recurrence/research-de441-seasonal-chunk-loader.js";
import { DE441_10026_SEASONAL_CROSSING_EVIDENCE } from "../src/astronomy/de441-10026-seasonal-crossing-evidence.js";

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

  for (const term of DE441_10026_SEASONAL_CROSSING_EVIDENCE.terms) {
    assert.equal(
      loaded.chunk.ttJulianDayFor({
        year:10026,
        longitudeDegrees:term.longitudeDegrees
      }),
      term.ttJulianDay
    );
  }
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
