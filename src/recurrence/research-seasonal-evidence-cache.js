const TERM_NAME_BY_LONGITUDE = Object.freeze(new Map([
  [0,"春分"],[15,"清明"],[30,"穀雨"],[45,"立夏"],[60,"小滿"],[75,"芒種"],
  [90,"夏至"],[105,"小暑"],[120,"大暑"],[135,"立秋"],[150,"處暑"],[165,"白露"],
  [180,"秋分"],[195,"寒露"],[210,"霜降"],[225,"立冬"],[240,"小雪"],[255,"大雪"],
  [270,"冬至"],[285,"小寒"],[300,"大寒"],[315,"立春"],[330,"雨水"],[345,"驚蟄"]
]));

const EVENT_BY_KEY = new Map();

function freeze(value) {
  return Object.freeze(value);
}

function normalizeDegrees(value) {
  if (!Number.isFinite(value)) throw new RangeError("longitudeDegrees must be finite");
  return ((value % 360) + 360) % 360;
}

function cacheKey(year, longitudeDegrees) {
  return `${year}:${normalizeDegrees(longitudeDegrees)}`;
}

function assertVerifiedResearchChunk(loaded) {
  if (!loaded || typeof loaded !== "object") throw new TypeError("loaded chunk is required");
  if (loaded.payloadIntegrityVerified !== true) {
    throw new Error("Research seasonal cache requires a digest-verified payload");
  }
  if (loaded.sourceEphemeris !== "DE441") {
    throw new Error("Research seasonal cache accepts only DE441-derived chunks");
  }
  if (loaded.timeScale !== "TT") {
    throw new Error("Research seasonal cache requires TT epochs");
  }
  if (loaded.productionAuthorityGranted !== false) {
    throw new Error("Research seasonal cache cannot accept production authority");
  }
  if (loaded.independentTargetYearTruth !== false) {
    throw new Error("Research seasonal cache cannot widen independent target-year truth");
  }
  if (!Number.isInteger(loaded.minYear) || !Number.isInteger(loaded.maxYear)) {
    throw new Error("Research seasonal cache requires integer catalogue-year coverage");
  }
  if (!loaded.chunk?.ttJulianDayFor) {
    throw new Error("Research seasonal cache requires a decoded chunk");
  }
}

export function installVerifiedResearchSeasonalChunk(loaded) {
  assertVerifiedResearchChunk(loaded);
  const evidenceId = loaded.evidenceIds?.[0];
  if (typeof evidenceId !== "string" || !evidenceId) {
    throw new Error("Research seasonal cache requires a pinned evidence id");
  }

  let installedEvents = 0;
  for (let year = loaded.minYear; year <= loaded.maxYear; year += 1) {
    for (let longitudeDegrees = 0; longitudeDegrees < 360; longitudeDegrees += 15) {
      const name = TERM_NAME_BY_LONGITUDE.get(longitudeDegrees);
      if (!name) throw new Error(`missing canonical seasonal term name for ${longitudeDegrees}°`);
      const ttJulianDay = loaded.chunk.ttJulianDayFor({ year, longitudeDegrees });
      const event = freeze({
        id:`${evidenceId}:${longitudeDegrees}`,
        evidenceId,
        validationKind:"source-derived-reconstruction",
        authority:"NASA/JPL DE441 + digest-verified compact Research chunk",
        sourceEphemeris:"DE441",
        year,
        name,
        longitudeDegrees,
        timeScale:"TT",
        ttJulianDay,
        independentTargetYearTruth:false,
        sourceDerivedTargetYear:true,
        frameIndependentlyValidatedAtTargetYear:false,
        productionIntegrated:false,
        productionAuthorityGranted:false,
        civilTimeResolved:false,
        transport:"verified-binary-chunk",
        payloadIntegrityVerified:true,
        payloadSha256:loaded.payloadSha256,
        chunkId:loaded.id
      });
      EVENT_BY_KEY.set(cacheKey(year, longitudeDegrees), event);
      installedEvents += 1;
    }
  }

  return freeze({
    chunkId:loaded.id,
    minYear:loaded.minYear,
    maxYear:loaded.maxYear,
    installedEvents,
    payloadSha256:loaded.payloadSha256,
    payloadIntegrityVerified:true,
    productionAuthorityGranted:false
  });
}

export function cachedResearchSeasonalEvidenceForLongitude({ year, longitudeDegrees }) {
  if (!Number.isInteger(year)) throw new RangeError("year must be an integer");
  return EVENT_BY_KEY.get(cacheKey(year, longitudeDegrees)) ?? null;
}

export function clearResearchSeasonalEvidenceCache() {
  EVENT_BY_KEY.clear();
}

export const RESEARCH_SEASONAL_EVIDENCE_CACHE_CONTRACT = freeze({
  id:"research-seasonal-evidence-cache-v1",
  acceptedTransport:"verified-binary-chunk",
  digestVerificationRequired:true,
  productionAuthorityGranted:false,
  independentTargetYearTruth:false,
  mutatesProductionRegistry:false
});
