import {
  SEASONAL_EPOCH_PROVIDER_ROLES,
  defineSeasonalEpochProvider
} from "../recurrence/seasonal-epoch-provider.js";
import {
  JPL_DE441_SHOUXING_4006_CROSSCHECK
} from "../recurrence/direct-seasonal-provider-validation-evidence.js";

const LONGITUDE_STEP_DEGREES = 15;
const EVENTS_PER_CATALOGUE_YEAR = 24;
const FULL_DE441_MIN_YEAR = -13_200;
const FULL_DE441_MAX_YEAR = 17_191;
const FLOAT64_BYTES = 8;
const ANGLE_EPSILON = 1e-12;

export const DE441_SEASONAL_EVENT_DATA_PROVIDER = defineSeasonalEpochProvider({
  id:"jpl-de441-seasonal-events-v1",
  role:SEASONAL_EPOCH_PROVIDER_ROLES.DIRECT_EVENT,
  label:"JPL DE441 · precomputed seasonal events",
  authority:"NASA/JPL Horizons quantity #31 / DE441",
  sourceUrl:"https://ssd.jpl.nasa.gov/horizons/manual.html",
  modelFamily:"jpl-de441-horizons-q31",
  coverage:{ mode:"absolute-year", minYear:4006, maxYear:4006 },
  capabilities:{
    relativeSeasonGeometry:true,
    absoluteStateVector:false,
    continuousDynamicalTime:true,
    directSeasonalEpoch:true
  },
  implementation:"bundled-pinned-seasonal-event-slice",
  timeScale:"TT",
  note:"Production direct-event data product. The published v1 slice contains only catalogue year 4006, derived from pinned Horizons quantity-31 / DE441 crossing truth. It intentionally does not expose state vectors and cannot answer outside its declared 4006 coverage."
});

const SOURCE_CROSSCHECK = JPL_DE441_SHOUXING_4006_CROSSCHECK;

function freezeAuthoritativeSourceTerm(term) {
  if (!Number.isFinite(term.jplDe441TtJulianDay)) {
    throw new TypeError(`missing DE441 TT epoch for ${term.name}`);
  }
  return Object.freeze({
    name:term.name,
    longitudeDegrees:term.longitudeDegrees,
    ttJulianDay:term.jplDe441TtJulianDay
  });
}

export const DE441_SEASONAL_EVENT_SOURCE_EVIDENCE = Object.freeze({
  id:"jpl-horizons-de441-4006-seasonal-events-source-v1",
  validationKind:"authoritative-source-pinning",
  authority:SOURCE_CROSSCHECK.authority,
  sourceUrl:"https://ssd.jpl.nasa.gov/horizons/",
  referenceFamily:"jpl-planetary-ephemeris",
  sourceEphemeris:SOURCE_CROSSCHECK.sourceEphemeris,
  target:SOURCE_CROSSCHECK.target,
  observerCenter:SOURCE_CROSSCHECK.observerCenter,
  quantity:SOURCE_CROSSCHECK.quantity,
  referenceSemantics:SOURCE_CROSSCHECK.referenceSemantics,
  timeScale:SOURCE_CROSSCHECK.timeScale,
  catalogueYear:SOURCE_CROSSCHECK.catalogueYear,
  sampledYears:SOURCE_CROSSCHECK.sampledYears,
  samplesByYear:SOURCE_CROSSCHECK.samplesByYear,
  crossings:SOURCE_CROSSCHECK.terms.length,
  researchWorkflowRunId:SOURCE_CROSSCHECK.researchWorkflowRunId,
  sourceCaptureSha256:SOURCE_CROSSCHECK.sourceCaptureSha256,
  sourceCrosscheckId:SOURCE_CROSSCHECK.id,
  terms:Object.freeze(SOURCE_CROSSCHECK.terms.map(freezeAuthoritativeSourceTerm)),
  note:"Authoritative source-pinning record for the JPL side of the original ShouXing crosscheck. It names no runtime provider and makes no model-independence claim; it only preserves the exact Horizons/DE441 seasonal-event payload provenance."
});

const SOURCE_EVIDENCE = DE441_SEASONAL_EVENT_SOURCE_EVIDENCE;

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function assertCatalogueYear(year) {
  if (!Number.isInteger(year)) throw new RangeError("year must be an integer catalogue year");
  const { minYear, maxYear } = DE441_SEASONAL_EVENT_DATA_PROVIDER.coverage;
  if (year < minYear || year > maxYear) {
    throw new RangeError(`year must be within published data-product coverage ${minYear}..${maxYear}`);
  }
}

function canonicalSeasonalLongitude(longitudeDegrees) {
  if (!Number.isFinite(longitudeDegrees)) throw new RangeError("longitudeDegrees must be finite");
  const normalized = normalizeDegrees(longitudeDegrees);
  const index = Math.round(normalized / LONGITUDE_STEP_DEGREES) % EVENTS_PER_CATALOGUE_YEAR;
  const canonical = index * LONGITUDE_STEP_DEGREES;
  const wrappedError = Math.min(
    Math.abs(normalized - canonical),
    360 - Math.abs(normalized - canonical)
  );
  if (wrappedError > ANGLE_EPSILON) {
    throw new RangeError("longitudeDegrees must be one of the 24 canonical 15° seasonal crossings");
  }
  return canonical;
}

function freezeEvent(term) {
  if (!Number.isFinite(term.ttJulianDay)) {
    throw new TypeError(`missing DE441 TT epoch for ${term.name}`);
  }
  return Object.freeze({
    providerId:DE441_SEASONAL_EVENT_DATA_PROVIDER.id,
    providerRole:DE441_SEASONAL_EVENT_DATA_PROVIDER.role,
    sourceEvidenceId:SOURCE_EVIDENCE.id,
    sourceEphemeris:SOURCE_EVIDENCE.sourceEphemeris,
    referenceSemantics:SOURCE_EVIDENCE.referenceSemantics,
    timeScale:"TT",
    yearBasis:"atlas-solar-term-catalogue",
    catalogueYear:4006,
    name:term.name,
    longitudeDegrees:canonicalSeasonalLongitude(term.longitudeDegrees),
    ttJulianDay:term.ttJulianDay
  });
}

const EVENTS_4006 = Object.freeze(
  SOURCE_EVIDENCE.terms
    .map(freezeEvent)
    .sort((left, right) => left.ttJulianDay - right.ttJulianDay)
);

if (EVENTS_4006.length !== EVENTS_PER_CATALOGUE_YEAR) {
  throw new RangeError(`expected ${EVENTS_PER_CATALOGUE_YEAR} year-4006 seasonal events`);
}
if (new Set(EVENTS_4006.map(event => event.longitudeDegrees)).size !== EVENTS_PER_CATALOGUE_YEAR) {
  throw new RangeError("year-4006 seasonal-event slice must contain every canonical longitude exactly once");
}

const EVENT_BY_LONGITUDE_4006 = new Map(
  EVENTS_4006.map(event => [event.longitudeDegrees, event])
);

const fullCoverageYears = FULL_DE441_MAX_YEAR - FULL_DE441_MIN_YEAR + 1;
const projectedEpochBytes = fullCoverageYears * EVENTS_PER_CATALOGUE_YEAR * FLOAT64_BYTES;

export const DE441_SEASONAL_EVENT_DATA_PRODUCT_MANIFEST = Object.freeze({
  schemaVersion:1,
  providerId:DE441_SEASONAL_EVENT_DATA_PROVIDER.id,
  providerRole:DE441_SEASONAL_EVENT_DATA_PROVIDER.role,
  payload:"24 apparent geocentric solar-longitude crossing epochs per catalogue year",
  validationKind:SOURCE_EVIDENCE.validationKind,
  sourceEvidenceId:SOURCE_EVIDENCE.id,
  referenceSemantics:SOURCE_EVIDENCE.referenceSemantics,
  timeScale:"TT",
  yearBasis:"atlas-solar-term-catalogue",
  publishedYears:Object.freeze([4006]),
  eventsPerYear:EVENTS_PER_CATALOGUE_YEAR,
  longitudeStepDegrees:LONGITUDE_STEP_DEGREES,
  currentSlice:Object.freeze({
    minYear:4006,
    maxYear:4006,
    events:EVENTS_4006.length,
    sourceEvidenceId:SOURCE_EVIDENCE.id,
    sourceCrosscheckId:SOURCE_EVIDENCE.sourceCrosscheckId,
    sourceCaptureSha256:SOURCE_EVIDENCE.sourceCaptureSha256
  }),
  fullDe441Projection:Object.freeze({
    minYear:FULL_DE441_MIN_YEAR,
    maxYear:FULL_DE441_MAX_YEAR,
    catalogueYears:fullCoverageYears,
    epochValues:fullCoverageYears * EVENTS_PER_CATALOGUE_YEAR,
    rawFloat64EpochBytes:projectedEpochBytes,
    note:"Projection counts TT epoch Float64 values only; indexes, integrity metadata and compression/container overhead are separate."
  }),
  productionIntegrated:true,
  productionIntegrationMode:"direct-event-runtime-registry"
});

export function seasonalEventsForCatalogueYear(year) {
  assertCatalogueYear(year);
  return EVENTS_4006;
}

export function seasonalEventForLongitude({ year, longitudeDegrees }) {
  assertCatalogueYear(year);
  const canonicalLongitude = canonicalSeasonalLongitude(longitudeDegrees);
  const event = EVENT_BY_LONGITUDE_4006.get(canonicalLongitude);
  if (!event) throw new RangeError(`no published seasonal event for ${canonicalLongitude}° in ${year}`);
  return event;
}
