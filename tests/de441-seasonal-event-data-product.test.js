import test from "node:test";
import assert from "node:assert/strict";
import {
  DE441_SEASONAL_EVENT_DATA_PRODUCT_MANIFEST,
  DE441_SEASONAL_EVENT_DATA_PROVIDER,
  DE441_SEASONAL_EVENT_SOURCE_EVIDENCE,
  seasonalEventForLongitude,
  seasonalEventsForCatalogueYear
} from "../src/astronomy/de441-seasonal-event-data-product.js";
import {
  JPL_DE441_SHOUXING_4006_CROSSCHECK
} from "../src/recurrence/direct-seasonal-provider-validation-evidence.js";
import {
  SEASONAL_EPOCH_PIPELINE,
  SEASONAL_EPOCH_SOURCES,
  seasonalEpochSourceAudit
} from "../src/recurrence/seasonal-epoch-source-audit.js";
import { SEASONAL_EPOCH_PROVIDER_ROLES } from "../src/recurrence/seasonal-epoch-provider.js";

const CHRONOLOGICAL_LONGITUDES = Object.freeze([
  270, 285, 300, 315, 330, 345,
  0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255
]);

test("DE441 seasonal-event slice is a direct-event product, not a state-vector provider", () => {
  const provider = DE441_SEASONAL_EVENT_DATA_PROVIDER;
  assert.equal(provider.role, SEASONAL_EPOCH_PROVIDER_ROLES.DIRECT_EVENT);
  assert.equal(provider.capabilities.directSeasonalEpoch, true);
  assert.equal(provider.capabilities.continuousDynamicalTime, true);
  assert.equal(provider.capabilities.absoluteStateVector, false);
  assert.deepEqual(provider.coverage, { mode:"absolute-year", minYear:4006, maxYear:4006 });
  assert.equal(provider.timeScale, "TT");
});

test("authoritative source evidence names the JPL payload without inheriting the ShouXing provider identity", () => {
  const evidence = DE441_SEASONAL_EVENT_SOURCE_EVIDENCE;
  assert.equal(evidence.validationKind, "authoritative-source-pinning");
  assert.equal(Object.hasOwn(evidence, "providerId"), false);
  assert.equal(evidence.sourceCrosscheckId, JPL_DE441_SHOUXING_4006_CROSSCHECK.id);
  assert.equal(evidence.authority, "NASA/JPL Horizons");
  assert.equal(evidence.sourceEphemeris, "DE441");
  assert.equal(evidence.referenceSemantics, "geocentric-apparent-solar-longitude-mean-ecliptic-of-date");
  assert.equal(evidence.timeScale, "TT");
  assert.equal(evidence.catalogueYear, 4006);
  assert.equal(evidence.crossings, 24);
  assert.equal(evidence.terms.length, 24);
  assert.match(evidence.sourceCaptureSha256, /^[a-f0-9]{64}$/);
});

test("published year-4006 slice contains all 24 Horizons quantity-31 crossings in epoch order", () => {
  const events = seasonalEventsForCatalogueYear(4006);
  assert.equal(events.length, 24);
  assert.deepEqual(events.map(event => event.longitudeDegrees), CHRONOLOGICAL_LONGITUDES);
  assert.ok(events.every((event, index) => index === 0 || event.ttJulianDay > events[index - 1].ttJulianDay));
  assert.ok(events.every(event => event.sourceEvidenceId === DE441_SEASONAL_EVENT_SOURCE_EVIDENCE.id));
  assert.equal(events[0].name, "冬至");
  assert.equal(events[0].catalogueYear, 4006);
  assert.equal(events[0].timeScale, "TT");
  assert.equal(events[0].referenceSemantics, "geocentric-apparent-solar-longitude-mean-ecliptic-of-date");
});

test("exact 15-degree lookup reproduces the pinned JPL side of the original crosscheck", () => {
  for (const term of JPL_DE441_SHOUXING_4006_CROSSCHECK.terms) {
    const event = seasonalEventForLongitude({ year:4006, longitudeDegrees:term.longitudeDegrees });
    assert.equal(event.name, term.name);
    assert.equal(event.ttJulianDay, term.jplDe441TtJulianDay);
    assert.equal(event.sourceEvidenceId, DE441_SEASONAL_EVENT_SOURCE_EVIDENCE.id);
    assert.equal(event.sourceEphemeris, "DE441");
  }
});

test("data product fails closed outside published coverage or canonical seasonal longitudes", () => {
  assert.throws(() => seasonalEventsForCatalogueYear(4005), /published data-product coverage/);
  assert.throws(() => seasonalEventsForCatalogueYear(4007), /published data-product coverage/);
  assert.throws(() => seasonalEventForLongitude({ year:4006, longitudeDegrees:7.5 }), /canonical 15° seasonal crossings/);
  assert.throws(() => seasonalEventForLongitude({ year:4006, longitudeDegrees:Number.NaN }), /finite/);
  assert.equal(seasonalEventForLongitude({ year:4006, longitudeDegrees:360 }).longitudeDegrees, 0);
  assert.equal(seasonalEventForLongitude({ year:4006, longitudeDegrees:-90 }).longitudeDegrees, 270);
});

test("manifest pins source provenance without pretending the full DE441 product is already published", () => {
  const manifest = DE441_SEASONAL_EVENT_DATA_PRODUCT_MANIFEST;
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.validationKind, "authoritative-source-pinning");
  assert.equal(manifest.sourceEvidenceId, DE441_SEASONAL_EVENT_SOURCE_EVIDENCE.id);
  assert.deepEqual(manifest.publishedYears, [4006]);
  assert.equal(manifest.currentSlice.events, 24);
  assert.equal(manifest.currentSlice.sourceEvidenceId, DE441_SEASONAL_EVENT_SOURCE_EVIDENCE.id);
  assert.equal(manifest.currentSlice.sourceCrosscheckId, JPL_DE441_SHOUXING_4006_CROSSCHECK.id);
  assert.equal(manifest.currentSlice.sourceCaptureSha256, DE441_SEASONAL_EVENT_SOURCE_EVIDENCE.sourceCaptureSha256);
  assert.equal(manifest.fullDe441Projection.catalogueYears, 30392);
  assert.equal(manifest.fullDe441Projection.epochValues, 729408);
  assert.equal(manifest.fullDe441Projection.rawFloat64EpochBytes, 5_835_264);
  assert.ok(manifest.fullDe441Projection.rawFloat64EpochBytes < 6_000_000);
  assert.equal(manifest.productionIntegrated, false);
});

test("bundled data slice alone does not mutate source or pipeline registries", () => {
  const providerId = DE441_SEASONAL_EVENT_DATA_PROVIDER.id;
  assert.equal(SEASONAL_EPOCH_SOURCES.some(source => source.id === providerId), false);
  assert.equal(SEASONAL_EPOCH_PIPELINE.directEventProviderIds.includes(providerId), false);
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterIds, []);
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterRuntimeCoverageById, {});
  const audit = seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006 });
  assert.equal(audit.status, "qualified-ephemeris-basis-not-integrated");
  assert.equal(audit.absoluteSeasonalEpochAvailable, false);
});
