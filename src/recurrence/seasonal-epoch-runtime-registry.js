import {
  DE441_SEASONAL_EVENT_DATA_PROVIDER,
  seasonalEventForLongitude as de441SeasonalEventForLongitude,
  seasonalEventsForCatalogueYear as de441SeasonalEventsForCatalogueYear
} from "../astronomy/de441-seasonal-event-data-product.js";
import { SEASONAL_EPOCH_PROVIDER_ROLES } from "./seasonal-epoch-provider.js";

function defineDirectRuntime({ provider, eventsForCatalogueYear, eventForLongitude }) {
  if (!provider || provider.role !== SEASONAL_EPOCH_PROVIDER_ROLES.DIRECT_EVENT) {
    throw new TypeError("direct seasonal runtime requires a direct-event provider");
  }
  if (typeof eventsForCatalogueYear !== "function") {
    throw new TypeError("direct seasonal runtime requires eventsForCatalogueYear");
  }
  if (typeof eventForLongitude !== "function") {
    throw new TypeError("direct seasonal runtime requires eventForLongitude");
  }
  return Object.freeze({ provider, eventsForCatalogueYear, eventForLongitude });
}

const DE441_4006_RUNTIME = defineDirectRuntime({
  provider:DE441_SEASONAL_EVENT_DATA_PROVIDER,
  eventsForCatalogueYear:de441SeasonalEventsForCatalogueYear,
  eventForLongitude:de441SeasonalEventForLongitude
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
