import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  RESEARCH_SEASONAL_CHUNK_LOADER_CONTRACT,
  clearResearchSeasonalChunkLoaderForTests,
  ensureResearchSeasonalEvidenceForYear,
  researchSeasonalEvidenceCatalogueHasYear
} from "../src/recurrence/research-seasonal-chunk-loader.js";
import {
  clearResearchSeasonalEvidenceForTests,
  researchSeasonalEvidenceForLongitude
} from "../src/recurrence/research-seasonal-evidence-registry.js";

async function fixture() {
  const manifest = JSON.parse(
    await readFile(
      new URL("../data/research/de441-seasonal-10026.manifest.json", import.meta.url),
      "utf8"
    )
  );
  const binary = new Uint8Array(
    await readFile(
      new URL("../data/research/de441-seasonal-10026.bin", import.meta.url)
    )
  );
  return { manifest, binary };
}

function arrayBufferOf(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function fixtureFetch({ manifest, binary, calls }) {
  return async url => {
    calls.push(String(url));
    if (String(url).endsWith(".manifest.json")) {
      return {
        ok:true,
        async json() { return structuredClone(manifest); }
      };
    }
    if (String(url).endsWith(".bin")) {
      return {
        ok:true,
        async arrayBuffer() { return arrayBufferOf(binary); }
      };
    }
    return { ok:false };
  };
}

function reset() {
  clearResearchSeasonalChunkLoaderForTests();
  clearResearchSeasonalEvidenceForTests();
}

test("Research seasonal loader catalogues 10026 without bundling its epochs", () => {
  reset();
  assert.deepEqual(RESEARCH_SEASONAL_CHUNK_LOADER_CONTRACT.cataloguedYears, [10026]);
  assert.equal(RESEARCH_SEASONAL_CHUNK_LOADER_CONTRACT.integrity, "sha256-before-install");
  assert.equal(RESEARCH_SEASONAL_CHUNK_LOADER_CONTRACT.staticEpochPayloadBundled, false);
  assert.equal(researchSeasonalEvidenceCatalogueHasYear(10026), true);
  assert.equal(researchSeasonalEvidenceCatalogueHasYear(26026), false);
  assert.equal(
    researchSeasonalEvidenceForLongitude({ year:10026, longitudeDegrees:315 }),
    null
  );
});

test("10026 lazy-load verifies the real binary digest before installing the TT slice", async () => {
  reset();
  const { manifest, binary } = await fixture();
  const calls = [];
  const result = await ensureResearchSeasonalEvidenceForYear(10026, {
    fetchImpl:fixtureFetch({ manifest, binary, calls }),
    cryptoImpl:webcrypto
  });

  assert.equal(result.status, "loaded");
  assert.equal(result.payloadSha256, manifest.payloadSha256);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].endsWith("de441-seasonal-10026.manifest.json"));
  assert.ok(calls[1].endsWith("de441-seasonal-10026.bin"));

  const liChun = researchSeasonalEvidenceForLongitude({
    year:10026,
    longitudeDegrees:315
  });
  assert.equal(liChun.ttJulianDay, 5383013.532143416);
  assert.equal(liChun.runtimePayloadSha256, manifest.payloadSha256);
  assert.equal(liChun.productionAuthorityGranted, false);
  assert.equal(liChun.independentTargetYearTruth, false);
});

test("concurrent 10026 requests share one manifest/binary load", async () => {
  reset();
  const { manifest, binary } = await fixture();
  const calls = [];
  const fetchImpl = fixtureFetch({ manifest, binary, calls });

  const [left, right] = await Promise.all([
    ensureResearchSeasonalEvidenceForYear(10026, { fetchImpl, cryptoImpl:webcrypto }),
    ensureResearchSeasonalEvidenceForYear(10026, { fetchImpl, cryptoImpl:webcrypto })
  ]);

  assert.equal(left.status, "loaded");
  assert.equal(right.status, "loaded");
  assert.equal(calls.length, 2);
});

test("tampered 10026 binary fails SHA-256 verification and is never installed", async () => {
  reset();
  const { manifest, binary } = await fixture();
  const tampered = binary.slice();
  tampered[tampered.length - 1] ^= 0x01;
  const calls = [];

  await assert.rejects(
    () => ensureResearchSeasonalEvidenceForYear(10026, {
      fetchImpl:fixtureFetch({ manifest, binary:tampered, calls }),
      cryptoImpl:webcrypto
    }),
    /SHA-256 mismatch/
  );
  assert.equal(
    researchSeasonalEvidenceForLongitude({ year:10026, longitudeDegrees:315 }),
    null
  );
});

test("manifest cannot promote source-derived 10026 evidence while loading it", async () => {
  reset();
  const { manifest, binary } = await fixture();
  const promoted = { ...manifest, productionAuthorityGranted:true };
  const calls = [];

  await assert.rejects(
    () => ensureResearchSeasonalEvidenceForYear(10026, {
      fetchImpl:fixtureFetch({ manifest:promoted, binary, calls }),
      cryptoImpl:webcrypto
    }),
    /non-production claim boundary/
  );
  assert.equal(calls.length, 1);
  assert.equal(
    researchSeasonalEvidenceForLongitude({ year:10026, longitudeDegrees:315 }),
    null
  );
});

test("uncatalogued 26026 fails closed without issuing a network request", async () => {
  reset();
  let calls = 0;
  const result = await ensureResearchSeasonalEvidenceForYear(26026, {
    fetchImpl:async () => {
      calls += 1;
      throw new Error("must not fetch");
    },
    cryptoImpl:webcrypto
  });

  assert.equal(result.status, "not-catalogued");
  assert.equal(calls, 0);
});
