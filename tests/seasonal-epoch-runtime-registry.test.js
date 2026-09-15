import test from "node:test";
import assert from "node:assert/strict";
import { DE441_SEASONAL_EVENT_DATA_PROVIDER } from "../src/astronomy/de441-seasonal-event-data-product.js";
import {
  DIRECT_SEASONAL_EVENT_RUNTIME_BY_ID,
  PRODUCTION_DIRECT_SEASONAL_EVENT_PROVIDER_IDS,
  PRODUCTION_DIRECT_SEASONAL_EVENT_PROVIDERS,
  productionDirectSeasonalEventRuntime,
  productionSeasonalEventForLongitude,
  productionSeasonalEventsForCatalogueYear
} from "../src/recurrence/seasonal-epoch-runtime-registry.js";

const PROVIDER_ID = DE441_SEASONAL_EVENT_DATA_PROVIDER.id;

test("production registry exposes exactly the bounded DE441 year-4006 direct provider", () => {
  assert.deepEqual(PRODUCTION_DIRECT_SEASONAL_EVENT_PROVIDER_IDS, [PROVIDER_ID]);
  assert.deepEqual(PRODUCTION_DIRECT_SEASONAL_EVENT_PROVIDERS, [DE441_SEASONAL_EVENT_DATA_PROVIDER]);
  assert.deepEqual(Object.keys(DIRECT_SEASONAL_EVENT_RUNTIME_BY_ID), [PROVIDER_ID]);
  const runtime = productionDirectSeasonalEventRuntime(PROVIDER_ID);
  assert.equal(runtime.provider, DE441_SEASONAL_EVENT_DATA_PROVIDER);
  assert.equal(typeof runtime.eventsForCatalogueYear, "function");
  assert.equal(typeof runtime.eventForLongitude, "function");
});

test("production runtime resolves all 24 year-4006 events through a callable registry", () => {
  const events = productionSeasonalEventsForCatalogueYear({ providerId:PROVIDER_ID, year:4006 });
  assert.equal(events.length, 24);
  assert.equal(events[0].catalogueYear, 4006);
  assert.ok(events.every(event => event.providerId === PROVIDER_ID));
  const equinox = productionSeasonalEventForLongitude({
    providerId:PROVIDER_ID,
    year:4006,
    longitudeDegrees:0
  });
  assert.equal(equinox.name, "春分");
  assert.equal(equinox.longitudeDegrees, 0);
  assert.equal(equinox.timeScale, "TT");
});

test("production runtime fails closed outside the published year or for an unknown provider", () => {
  assert.throws(
    () => productionSeasonalEventsForCatalogueYear({ providerId:PROVIDER_ID, year:4005 }),
    /published data-product coverage/
  );
  assert.throws(
    () => productionSeasonalEventsForCatalogueYear({ providerId:PROVIDER_ID, year:4007 }),
    /published data-product coverage/
  );
  assert.throws(
    () => productionDirectSeasonalEventRuntime("jpl-de441"),
    /no production direct seasonal-event runtime/
  );
});
