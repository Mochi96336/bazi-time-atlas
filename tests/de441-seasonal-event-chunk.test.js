import test from "node:test";
import assert from "node:assert/strict";
import {
  DE441_SEASONAL_EVENT_SOURCE_EVIDENCE,
  seasonalEventsForCatalogueYear
} from "../src/astronomy/de441-seasonal-event-data-product.js";
import {
  DE441_SEASONAL_CHUNK_FORMAT,
  canonicalEpochsFromSeasonalEvents,
  de441SeasonalChunkByteLength,
  de441SeasonalChunkPayloadBytes,
  decodeDe441SeasonalEpochChunk,
  encodeDe441SeasonalEpochChunk
} from "../src/astronomy/de441-seasonal-event-chunk.js";

function row(year, events) {
  return { year, epochs:canonicalEpochsFromSeasonalEvents(events) };
}

test("Float64 seasonal chunk round-trips the authoritative 4006 production slice exactly", () => {
  const events = seasonalEventsForCatalogueYear(4006);
  const bytes = encodeDe441SeasonalEpochChunk({
    minYear:4006,
    years:[row(4006, events)]
  });
  const chunk = decodeDe441SeasonalEpochChunk(bytes);

  assert.equal(chunk.encoding, DE441_SEASONAL_CHUNK_FORMAT.id);
  assert.equal(chunk.minYear, 4006);
  assert.equal(chunk.maxYear, 4006);
  assert.equal(chunk.yearCount, 1);
  assert.equal(chunk.byteLength, 32 + 24 * 8);

  for (const event of events) {
    assert.equal(
      chunk.ttJulianDayFor({ year:4006, longitudeDegrees:event.longitudeDegrees }),
      event.ttJulianDay
    );
  }
  assert.equal(
    chunk.ttJulianDayFor({ year:4006, longitudeDegrees:315 }),
    DE441_SEASONAL_EVENT_SOURCE_EVIDENCE.terms.find(term => term.longitudeDegrees === 315).ttJulianDay
  );
});

test("chunk format keeps the full DE441 epoch payload near the existing 5.8 MB projection", () => {
  const fullYears = 17_191 - (-13_200) + 1;
  assert.equal(fullYears, 30_392);
  assert.equal(de441SeasonalChunkPayloadBytes(fullYears), 5_835_264);
  assert.equal(de441SeasonalChunkByteLength(fullYears), 5_835_296);
  assert.equal(de441SeasonalChunkByteLength(1000), 192_032);
});

test("chunk codec rejects non-canonical longitudes and incomplete seasonal rows", () => {
  const events = seasonalEventsForCatalogueYear(4006);
  const bytes = encodeDe441SeasonalEpochChunk({
    minYear:4006,
    years:[row(4006, events)]
  });
  const chunk = decodeDe441SeasonalEpochChunk(bytes);

  assert.throws(
    () => chunk.ttJulianDayFor({ year:4006, longitudeDegrees:314.5 }),
    /24 canonical/
  );
  assert.throws(
    () => encodeDe441SeasonalEpochChunk({
      minYear:4006,
      years:[{ year:4006, epochs:[1,2,3] }]
    }),
    /24 epochs/
  );
});
