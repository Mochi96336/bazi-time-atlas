import {
  DE441_SEASONAL_EVENT_DATA_PRODUCT_MANIFEST,
  DE441_SEASONAL_EVENT_DATA_PROVIDER,
  DE441_SEASONAL_EVENT_SOURCE_EVIDENCE,
  seasonalEventForLongitude as de441SeasonalEventForLongitude,
  seasonalEventsForCatalogueYear as de441SeasonalEventsForCatalogueYear
} from "../astronomy/de441-seasonal-event-data-product.js";
import { DE441_SEASONAL_CROSSING_4006_EVIDENCE } from "../astronomy/de441-seasonal-crossing-evidence.js";
import {
  assessAuthoritativeSeasonalDataProductRegistration
} from "./authoritative-seasonal-data-product-registration.js";
import { SEASONAL_EPOCH_PROVIDER_ROLES } from "./seasonal-epoch-provider.js";

const DE441_V1_TARGET_YEAR = 4006;

export const DE441_SEASONAL_EVENT_RUNTIME_REGISTRATION =
  assessAuthoritativeSeasonalDataProductRegistration({
    provider:DE441_SEASONAL_EVENT_DATA_PROVIDER,
    manifest:DE441_SEASONAL_EVENT_DATA_PRODUCT_MANIFEST,
    sourceEvidence:DE441_SEASONAL_EVENT_SOURCE_EVIDENCE,
    reconstructionEvidence:DE441_SEASONAL_CROSSING_4006_EVIDENCE,
    events:de441SeasonalEventsForCatalogueYear(DE441_V1_TARGET_YEAR),
    targetYear:DE441_V1_TARGET_YEAR
  });

if (!DE441_SEASONAL_EVENT_RUNTIME_REGISTRATION.productionRegistrationEligible) {
  throw new Error(
    `DE441 seasonal-event runtime registration rejected: ${DE441_SEASONAL_EVENT_RUNTIME_REGISTRATION.status}`
  );
}

function defineDirectRuntime({ provider, eventsForCatalogueYear, eventForLongitude, registration }) {
  if (!provider || provider.role !== SEASONAL_EPOCH_PROVIDER_ROLES.DIRECT_EVENT) {
    throw new TypeError("direct seasonal runtime requires a direct-event provider");
  }
  if (typeof eventsForCatalogueYear !== "function") {
    throw new TypeError("direct seasonal runtime requires eventsForCatalogueYear");
  }
  if (typeof eventForLongitude !== "function") {
    throw new TypeError("direct seasonal runtime requires eventForLongitude");
  }
  if (!registration?.productionRegistrationEligible || registration.providerId !== provider.id) {
    throw new TypeError("direct seasonal runtime requires a passing authoritative registration assessment");
  }
  return Object.freeze({ provider, eventsForCatalogueYear, eventForLongitude, registration });
}

const DE441_4006_RUNTIME = defineDirectRuntime({
  provider:DE441_SEASONAL_EVENT_DATA_PROVIDER,
  eventsForCatalogueYear:de441SeasonalEventsForCatalogueYear,
  eventForLongitude:de441SeasonalEventForLongitude,
  registration:DE441_SEASONAL_EVENT_RUNTIME_REGISTRATION
});

export const DIRECT_SEASONAL_EVENT_RUNTIME_BY_ID = Object.freeze({
  [DE441_SEASONAL_EVENT_DATA_PROVIDER.id]:DE441_4006_RUNTIME
});

export const PRODUCTION_DIRECT_SEASONAL_EVENT_PROVIDER_IDS = Object.freeze(
  Object.keys(DIRECT_SEASONAL_EVENT_RUNTIME_BY_ID)
);

export const PRODUCTION_DIRECT_SEASONAL_EVENT_PROVIDERS = Object.freeze(
  PRODUCTION_DIRECT_SEASONAL_EVENT_PROVIDER_IDS.map(
    id => DIRECT_SEASONAL_EVENT_RUNTIME_BY_ID[id].provider
  )
);

export function productionDirectSeasonalEventRuntime(providerId) {
  if (!providerId || typeof providerId !== "string") {
    throw new TypeError("providerId is required");
  }
  const runtime = DIRECT_SEASONAL_EVENT_RUNTIME_BY_ID[providerId];
  if (!runtime) throw new RangeError(`no production direct seasonal-event runtime registered for ${providerId}`);
  return runtime;
}

export function productionSeasonalEventsForCatalogueYear({ providerId, year }) {
  return productionDirectSeasonalEventRuntime(providerId).eventsForCatalogueYear(year);
}

export function productionSeasonalEventForLongitude({ providerId, year, longitudeDegrees }) {
  return productionDirectSeasonalEventRuntime(providerId).eventForLongitude({
    year,
    longitudeDegrees
  });
}
