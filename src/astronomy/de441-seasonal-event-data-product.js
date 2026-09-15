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
  note:"Runtime-shaped direct-event data product. The published v1 slice currently contains only catalogue year 4006, derived from pinned Horizons quantity-31 / DE441 crossing truth. It intentionally does not expose state vectors and is not yet registered in the production seasonal pipeline."
});

const SOURCE_EVIDENCE = JPL_DE441_SHOUXING_4006_CROSSCHECK;

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
  if (!Number.isFinite(term.jplDe441TtJulianDay)) {
    throw new TypeError(`missing DE441 TT epoch for ${term.name}`);
  }
  return Object.freeze({
    providerId:DE441_SEASONAL_EVENT_DATA_PROVIDER.id,
    providerRole:DE441_SEASONAL_EVENT_DATA_PROVIDER.role,
    sourceEvidenceId:SOURCE_EVIDENCE.id,
    sourceEphemeris:"DE441",
    referenceSemantics:SOURCE_EVIDENCE.referenceSemantics,
    timeScale:"TT",
    yearBasis:"atlas-solar-term-catalogue",
    catalogueYear:4006,
    name:term.name,
    longitudeDegrees:canonicalSeasonalLongitude(term.longitudeDegrees),
    ttJulianDay:term.jplDe441TtJulianDay
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
  productionIntegrated:false
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
