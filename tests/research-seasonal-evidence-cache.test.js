import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  verifyResearchDe441SeasonalChunk
} from "../src/recurrence/research-de441-seasonal-chunk-loader.js";
import {
  RESEARCH_SEASONAL_EVIDENCE_CACHE_CONTRACT,
  cachedResearchSeasonalEvidenceForLongitude,
  clearResearchSeasonalEvidenceCache,
  installVerifiedResearchSeasonalChunk
} from "../src/recurrence/research-seasonal-evidence-cache.js";
import { DE441_10026_SEASONAL_CROSSING_EVIDENCE } from "../src/astronomy/de441-10026-seasonal-crossing-evidence.js";

const ASSET = new URL("../assets/research/de441-seasonal/10026.bin", import.meta.url);
const MANIFEST = new URL("../assets/research/de441-seasonal/10026.manifest.json", import.meta.url);

async function verified10026Chunk() {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  const bytes = new Uint8Array(await readFile(ASSET));
  return verifyResearchDe441SeasonalChunk({ manifest, bytes });
}

test("digest-verified binary chunk installs all 24 Research events into the cache", async () => {
  clearResearchSeasonalEvidenceCache();
  const loaded = await verified10026Chunk();
  const installed = installVerifiedResearchSeasonalChunk(loaded);

  assert.equal(installed.installedEvents, 24);
  assert.equal(installed.payloadIntegrityVerified, true);
  const liChun = cachedResearchSeasonalEvidenceForLongitude({
    year:10026,
    longitudeDegrees:315
  });
  assert.ok(liChun);
  assert.equal(liChun.transport, "verified-binary-chunk");
  assert.equal(liChun.payloadIntegrityVerified, true);
  assert.equal(liChun.payloadSha256, loaded.payloadSha256);
  assert.equal(liChun.ttJulianDay, DE441_10026_SEASONAL_CROSSING_EVIDENCE.liChun.ttJulianDay);
  assert.equal(liChun.productionAuthorityGranted, false);
  assert.equal(liChun.independentTargetYearTruth, false);

  clearResearchSeasonalEvidenceCache();
});

test("Research cache rejects a chunk whose integrity or authority boundary was widened", async () => {
  clearResearchSeasonalEvidenceCache();
  const loaded = await verified10026Chunk();

  assert.throws(
    () => installVerifiedResearchSeasonalChunk({ ...loaded, payloadIntegrityVerified:false }),
    /digest-verified/
  );
  assert.throws(
    () => installVerifiedResearchSeasonalChunk({ ...loaded, productionAuthorityGranted:true }),
    /production authority/
  );
  assert.equal(
    cachedResearchSeasonalEvidenceForLongitude({ year:10026, longitudeDegrees:315 }),
    null
  );
});

test("Research cache contract cannot mutate production authority", () => {
  assert.equal(RESEARCH_SEASONAL_EVIDENCE_CACHE_CONTRACT.digestVerificationRequired, true);
  assert.equal(RESEARCH_SEASONAL_EVIDENCE_CACHE_CONTRACT.productionAuthorityGranted, false);
  assert.equal(RESEARCH_SEASONAL_EVIDENCE_CACHE_CONTRACT.mutatesProductionRegistry, false);
});
