import {
  decodeDe441SeasonalEpochChunk
} from "../astronomy/de441-seasonal-event-chunk.js";
import {
  installResearchSeasonalEvidenceChunk,
  researchSeasonalEvidenceLoadedForYear
} from "./research-seasonal-evidence-registry.js";

const catalogue = Object.freeze({
  10026:Object.freeze({
    manifestUrl:new URL(
      "../../data/research/de441-seasonal-10026.manifest.json",
      import.meta.url
    ).href
  })
});

const loads = new Map();

function freeze(value) {
  return Object.freeze(value);
}

function hex(bytes) {
  return [...new Uint8Array(bytes)]
    .map(value => value.toString(16).padStart(2, "0"))
    .join("");
}

function assertManifest(manifest, requestedYear) {
  if (!manifest || typeof manifest !== "object") throw new TypeError("seasonal manifest is required");
  if (manifest.schemaVersion !== 1) throw new RangeError("unsupported Research seasonal manifest schema");
  if (manifest.encoding !== "bta-de441-seasonal-f64le-v1") {
    throw new RangeError("unsupported Research seasonal chunk encoding");
  }
  if (manifest.sourceEphemeris !== "DE441") throw new RangeError("Research seasonal manifest source mismatch");
  if (manifest.timeScale !== "TT") throw new RangeError("Research seasonal manifest time-scale mismatch");
  if (
    !Number.isInteger(manifest.minYear)
    || !Number.isInteger(manifest.maxYear)
    || requestedYear < manifest.minYear
    || requestedYear > manifest.maxYear
  ) {
    throw new RangeError("Research seasonal manifest does not cover the requested year");
  }
  if (!Number.isInteger(manifest.byteLength) || manifest.byteLength < 1) {
    throw new RangeError("Research seasonal manifest byte length is invalid");
  }
  if (typeof manifest.payloadSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(manifest.payloadSha256)) {
    throw new RangeError("Research seasonal manifest SHA-256 is invalid");
  }
  if (typeof manifest.asset !== "string" || !manifest.asset) {
    throw new RangeError("Research seasonal manifest asset is missing");
  }
  if (
    manifest.productionAuthorityGranted !== false
    || manifest.productionIntegrated !== false
    || manifest.independentTargetYearTruth !== false
    || manifest.sourceDerivedTargetYear !== true
  ) {
    throw new RangeError("Research seasonal manifest violates the non-production claim boundary");
  }
}

async function responseJson(response, label) {
  if (!response?.ok) throw new Error(`${label} fetch failed`);
  return response.json();
}

async function responseBytes(response, label) {
  if (!response?.ok) throw new Error(`${label} fetch failed`);
  return new Uint8Array(await response.arrayBuffer());
}

async function loadYear(year, { fetchImpl, cryptoImpl }) {
  const entry = catalogue[year];
  if (!entry) {
    return freeze({ status:"not-catalogued", year });
  }

  const manifestResponse = await fetchImpl(entry.manifestUrl);
  const manifest = await responseJson(manifestResponse, "Research seasonal manifest");
  assertManifest(manifest, year);

  const assetUrl = new URL(manifest.asset, entry.manifestUrl).href;
  const bytes = await responseBytes(
    await fetchImpl(assetUrl),
    "Research seasonal binary"
  );
  if (bytes.byteLength !== manifest.byteLength) {
    throw new RangeError("Research seasonal binary byte length does not match manifest");
  }

  if (!cryptoImpl?.subtle?.digest) {
    throw new Error("SHA-256 verification is unavailable");
  }
  const digest = hex(await cryptoImpl.subtle.digest("SHA-256", bytes));
  if (digest !== manifest.payloadSha256.toLowerCase()) {
    throw new RangeError("Research seasonal binary SHA-256 mismatch");
  }

  const chunk = decodeDe441SeasonalEpochChunk(bytes);
  if (
    chunk.minYear !== manifest.minYear
    || chunk.maxYear !== manifest.maxYear
    || chunk.yearCount !== manifest.yearCount
    || chunk.eventsPerYear !== manifest.eventsPerYear
    || chunk.encoding !== manifest.encoding
  ) {
    throw new RangeError("Research seasonal binary header does not match manifest");
  }

  const installation = installResearchSeasonalEvidenceChunk({ manifest, chunk });
  return freeze({
    status:"loaded",
    year,
    manifestId:manifest.id,
    payloadSha256:manifest.payloadSha256,
    assetUrl,
    installation
  });
}

export function researchSeasonalEvidenceCatalogueHasYear(year) {
  if (!Number.isInteger(year)) throw new RangeError("year must be an integer");
  return Object.hasOwn(catalogue, year);
}

export function ensureResearchSeasonalEvidenceForYear(
  year,
  {
    fetchImpl = globalThis.fetch,
    cryptoImpl = globalThis.crypto
  } = {}
) {
  if (!Number.isInteger(year)) throw new RangeError("year must be an integer");
  if (researchSeasonalEvidenceLoadedForYear(year)) {
    return Promise.resolve(freeze({ status:"already-loaded", year }));
  }
  if (!researchSeasonalEvidenceCatalogueHasYear(year)) {
    return Promise.resolve(freeze({ status:"not-catalogued", year }));
  }
  if (typeof fetchImpl !== "function") {
    return Promise.reject(new TypeError("fetch implementation is required"));
  }

  if (!loads.has(year)) {
    const promise = loadYear(year, { fetchImpl, cryptoImpl })
      .catch(error => {
        loads.delete(year);
        throw error;
      });
    loads.set(year, promise);
  }
  return loads.get(year);
}

export function clearResearchSeasonalChunkLoaderForTests() {
  loads.clear();
}

export const RESEARCH_SEASONAL_CHUNK_LOADER_CONTRACT = freeze({
  id:"research-seasonal-chunk-loader-v1",
  cataloguedYears:freeze(Object.keys(catalogue).map(Number)),
  integrity:"sha256-before-install",
  productionAuthorityGranted:false,
  staticEpochPayloadBundled:false
});
