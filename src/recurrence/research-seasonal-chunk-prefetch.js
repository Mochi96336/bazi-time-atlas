import {
  loadResearchDe441SeasonalChunk
} from "./research-de441-seasonal-chunk-loader.js";
import {
  installVerifiedResearchSeasonalChunk
} from "./research-seasonal-evidence-cache.js";

export const RESEARCH_SEASONAL_EVIDENCE_READY_EVENT = "research-seasonal-evidence-ready";
export const RESEARCH_SEASONAL_EVIDENCE_ERROR_EVENT = "research-seasonal-evidence-error";

const YEAR_10026_MANIFEST_URL = new URL(
  "../../assets/research/de441-seasonal/10026.manifest.json",
  import.meta.url
);
const YEAR_10026_BINARY_URL = new URL(
  "../../assets/research/de441-seasonal/10026.bin",
  import.meta.url
);

function freeze(value) {
  return Object.freeze(value);
}

export async function prefetchYear10026SeasonalEvidence({
  fetchImpl = globalThis.fetch,
  cryptoImpl = globalThis.crypto,
  install = installVerifiedResearchSeasonalChunk,
  manifestUrl = YEAR_10026_MANIFEST_URL,
  binaryUrl = YEAR_10026_BINARY_URL
} = {}) {
  const loaded = await loadResearchDe441SeasonalChunk({
    manifestUrl,
    binaryUrl,
    fetchImpl,
    cryptoImpl
  });
  const installed = install(loaded);
  return freeze({
    status:"ready",
    year:10026,
    transport:"verified-binary-chunk",
    chunkId:loaded.id,
    payloadSha256:loaded.payloadSha256,
    payloadIntegrityVerified:loaded.payloadIntegrityVerified,
    installedEvents:installed.installedEvents,
    productionAuthorityGranted:false,
    independentTargetYearTruth:false
  });
}

function dispatchResearchEvidenceEvent(name, detail) {
  if (typeof document === "undefined" || typeof CustomEvent === "undefined") return;
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

export const researchSeasonalEvidencePrefetch = typeof document === "undefined"
  ? null
  : prefetchYear10026SeasonalEvidence()
    .then(result => {
      dispatchResearchEvidenceEvent(RESEARCH_SEASONAL_EVIDENCE_READY_EVENT, result);
      return result;
    })
    .catch(error => {
      const detail = freeze({
        status:"error",
        year:10026,
        transport:"pinned-js-fallback",
        message:error instanceof Error ? error.message : String(error),
        productionAuthorityGranted:false
      });
      dispatchResearchEvidenceEvent(RESEARCH_SEASONAL_EVIDENCE_ERROR_EVENT, detail);
      return detail;
    });

export const RESEARCH_SEASONAL_PREFETCH_CONTRACT = freeze({
  id:"research-seasonal-binary-prefetch-v1",
  targetYear:10026,
  assetLoad:"lazy-browser-fetch",
  readyEvent:RESEARCH_SEASONAL_EVIDENCE_READY_EVENT,
  errorFallback:"pinned-js-evidence",
  payloadIntegrityRequired:true,
  productionAuthorityGranted:false
});
