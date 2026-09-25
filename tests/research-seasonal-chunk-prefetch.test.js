import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  RESEARCH_SEASONAL_PREFETCH_CONTRACT,
  prefetchYear10026SeasonalEvidence
} from "../src/recurrence/research-seasonal-chunk-prefetch.js";

const ASSET = new URL("../assets/research/de441-seasonal/10026.bin", import.meta.url);
const MANIFEST = new URL("../assets/research/de441-seasonal/10026.manifest.json", import.meta.url);

test("year-10026 prefetch verifies the real asset before handing it to cache installation", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  const bytes = new Uint8Array(await readFile(ASSET));
  const calls = [];
  const fetchImpl = async url => {
    calls.push(String(url));
    if (String(url).endsWith(".manifest.json")) {
      return { ok:true, json:async () => manifest };
    }
    return {
      ok:true,
      arrayBuffer:async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    };
  };
  let installed = null;
  const result = await prefetchYear10026SeasonalEvidence({
    fetchImpl,
    install:loaded => {
      installed = loaded;
      return { installedEvents:24 };
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(result.status, "ready");
  assert.equal(result.year, 10026);
  assert.equal(result.transport, "verified-binary-chunk");
  assert.equal(result.payloadIntegrityVerified, true);
  assert.equal(result.installedEvents, 24);
  assert.ok(installed);
  assert.equal(installed.productionAuthorityGranted, false);
  assert.equal(installed.independentTargetYearTruth, false);
});

test("prefetch contract keeps failure fallback separate from production authority", () => {
  assert.equal(RESEARCH_SEASONAL_PREFETCH_CONTRACT.assetLoad, "lazy-browser-fetch");
  assert.equal(RESEARCH_SEASONAL_PREFETCH_CONTRACT.errorFallback, "pinned-js-evidence");
  assert.equal(RESEARCH_SEASONAL_PREFETCH_CONTRACT.payloadIntegrityRequired, true);
  assert.equal(RESEARCH_SEASONAL_PREFETCH_CONTRACT.productionAuthorityGranted, false);
});
