import {
  DE441_SEASONAL_CHUNK_FORMAT,
  decodeDe441SeasonalEpochChunk
} from "../astronomy/de441-seasonal-event-chunk.js";

const EXPECTED_REFERENCE_SEMANTICS =
  "geocentric-apparent-solar-longitude-mean-ecliptic-of-date";

function freeze(value) {
  return Object.freeze(value);
}

function validSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function bytesToHex(bytes) {
  return [...bytes].map(value => value.toString(16).padStart(2,"0")).join("");
}

async function sha256Hex(bytes, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle?.digest) {
    throw new Error("Web Crypto SHA-256 is unavailable");
  }
  const digest = await cryptoImpl.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  );
  return bytesToHex(new Uint8Array(digest));
}

function validateManifest(manifest) {
  const failures = [];
  if (!manifest || typeof manifest !== "object") return ["manifest-shape"];
  if (manifest.schemaVersion !== 1) failures.push("manifest-schema");
  if (manifest.encoding !== DE441_SEASONAL_CHUNK_FORMAT.id) failures.push("chunk-encoding");
  if (manifest.chunkSchemaVersion !== DE441_SEASONAL_CHUNK_FORMAT.schemaVersion) failures.push("chunk-schema");
  if (manifest.sourceEphemeris !== "DE441") failures.push("source-ephemeris");
  if (manifest.referenceSemantics !== EXPECTED_REFERENCE_SEMANTICS) failures.push("reference-semantics");
  if (manifest.timeScale !== "TT") failures.push("time-scale");
  if (manifest.yearBasis !== DE441_SEASONAL_CHUNK_FORMAT.yearBasis) failures.push("year-basis");
  if (!Number.isInteger(manifest.minYear) || !Number.isInteger(manifest.maxYear)) failures.push("year-range");
  if (manifest.minYear !== manifest.maxYear) failures.push("single-year-research-slice");
  if (manifest.yearCount !== 1) failures.push("year-count");
  if (manifest.eventsPerYear !== DE441_SEASONAL_CHUNK_FORMAT.eventsPerYear) failures.push("events-per-year");
  if (manifest.longitudeStepDegrees !== DE441_SEASONAL_CHUNK_FORMAT.longitudeStepDegrees) failures.push("longitude-step");
  if (!Number.isInteger(manifest.byteLength) || manifest.byteLength <= 0) failures.push("byte-length");
  if (!validSha256(manifest.payloadSha256)) failures.push("payload-sha256");
  if (!Array.isArray(manifest.evidenceIds) || manifest.evidenceIds.length < 1) failures.push("evidence-ids");
  if (manifest.claimClass !== "de441-derived") failures.push("claim-class");
  if (manifest.productionAuthorityGranted !== false) failures.push("production-authority-boundary");
  if (manifest.independentTargetYearTruth !== false) failures.push("independent-target-year-truth-boundary");
  return failures;
}

export async function verifyResearchDe441SeasonalChunk({
  manifest,
  bytes,
  cryptoImpl = globalThis.crypto
}) {
  const failures = validateManifest(manifest);
  if (!(bytes instanceof Uint8Array)) failures.push("payload-type");
  if (bytes instanceof Uint8Array && bytes.byteLength !== manifest?.byteLength) {
    failures.push("payload-byte-length");
  }
  if (failures.length) {
    throw new Error(`invalid Research DE441 seasonal chunk: ${failures.join(",")}`);
  }

  const actualSha256 = await sha256Hex(bytes, cryptoImpl);
  if (actualSha256 !== manifest.payloadSha256.toLowerCase()) {
    throw new Error(
      `Research DE441 seasonal chunk SHA-256 mismatch: expected ${manifest.payloadSha256}, got ${actualSha256}`
    );
  }

  const chunk = decodeDe441SeasonalEpochChunk(bytes);
  if (
    chunk.minYear !== manifest.minYear
    || chunk.maxYear !== manifest.maxYear
    || chunk.yearCount !== manifest.yearCount
    || chunk.eventsPerYear !== manifest.eventsPerYear
    || chunk.longitudeStepDegrees !== manifest.longitudeStepDegrees
  ) {
    throw new Error("Research DE441 seasonal chunk header/manifest mismatch");
  }

  return freeze({
    id:manifest.id,
    manifest:freeze({ ...manifest }),
    chunk,
    payloadIntegrityVerified:true,
    payloadSha256:actualSha256,
    sourceEphemeris:manifest.sourceEphemeris,
    referenceSemantics:manifest.referenceSemantics,
    timeScale:manifest.timeScale,
    minYear:manifest.minYear,
    maxYear:manifest.maxYear,
    evidenceIds:freeze([...manifest.evidenceIds]),
    claimClass:manifest.claimClass,
    productionAuthorityGranted:false,
    independentTargetYearTruth:false
  });
}

export async function loadResearchDe441SeasonalChunk({
  manifestUrl,
  binaryUrl,
  fetchImpl = globalThis.fetch,
  cryptoImpl = globalThis.crypto
}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation is unavailable");

  const [manifestResponse, binaryResponse] = await Promise.all([
    fetchImpl(manifestUrl),
    fetchImpl(binaryUrl)
  ]);
  if (!manifestResponse?.ok) {
    throw new Error(`Research DE441 manifest fetch failed: ${manifestResponse?.status ?? "unknown"}`);
  }
  if (!binaryResponse?.ok) {
    throw new Error(`Research DE441 binary fetch failed: ${binaryResponse?.status ?? "unknown"}`);
  }

  const manifest = await manifestResponse.json();
  const bytes = new Uint8Array(await binaryResponse.arrayBuffer());
  return verifyResearchDe441SeasonalChunk({ manifest, bytes, cryptoImpl });
}

export const RESEARCH_DE441_SEASONAL_CHUNK_LOADER_CONTRACT = freeze({
  id:"research-de441-seasonal-chunk-loader-v1",
  digest:"SHA-256",
  integrityRequiredBeforeDecode:true,
  productionAuthorityGranted:false,
  independentTargetYearTruth:false,
  asynchronousAssetLoad:true
});
