import test from "node:test";
import assert from "node:assert/strict";
import { SolarTime } from "../vendor/tyme4ts-1.5.2.mjs";
import { seasonalEventsForCatalogueYear } from "../src/astronomy/de441-seasonal-event-data-product.js";
import { estimateDeepTimeUt1FromTtJulianDay } from "../src/astronomy/deep-time-earth-rotation.js";
import { DAY_BOUNDARY } from "../src/calendar/tyme-adapter.js";
import {
  DAY_HOUR_UNCERTAINTY_ENVELOPE_CONTRACT,
  dayHourPillarEnvelopeFromUt1Estimate
} from "../src/recurrence/day-hour-uncertainty-envelope.js";

const SECONDS_PER_DAY = 86_400;

function ut1JulianDayForFixedLocalClock(input, localOffsetHoursFromUt1 = 8) {
  const local = SolarTime.fromYmdHms(
    input.year,
    input.month,
    input.day,
    input.hour,
    input.minute ?? 0,
    input.second ?? 0
  );
  return local.getJulianDay().getDay() - localOffsetHoursFromUt1 / 24;
}

function statisticalEstimateAtLocalClock(input, halfSpanSeconds, localOffsetHoursFromUt1 = 8) {
  const center = ut1JulianDayForFixedLocalClock(input, localOffsetHoursFromUt1);
  const halfSpanDays = halfSpanSeconds / SECONDS_PER_DAY;
  return Object.freeze({
    ut1JulianDayEstimate:center,
    oneSigmaUt1JulianDayMin:center - halfSpanDays,
    oneSigmaUt1JulianDayMax:center + halfSpanDays,
    uncertaintySemantics:"one-standard-error-not-hard-bound"
  });
}

const EXPLICIT_ZI_CONVENTION = Object.freeze({
  localOffsetHoursFromUt1:8,
  dayBoundary:DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
});

test("narrow fixed-zone UT1 envelope can be unique within the statistical interval without becoming deterministic truth", () => {
  const envelope = dayHourPillarEnvelopeFromUt1Estimate(
    statisticalEstimateAtLocalClock({ year:2026, month:9, day:13, hour:12, minute:0 }, 20 * 60),
    EXPLICIT_ZI_CONVENTION
  );

  assert.equal(envelope.day.uniqueWithinInterval, true);
  assert.equal(envelope.hour.uniqueWithinInterval, true);
  assert.equal(envelope.day.candidateCount, 1);
  assert.equal(envelope.hour.candidateCount, 1);
  assert.equal(envelope.interval.hardBound, false);
  assert.equal(envelope.deterministic, false);
  assert.equal(envelope.resolvesTrueDeepTimePillars, false);
  assert.equal(envelope.unlocksDayHour, false);
});

test("crossing a two-hour branch boundary preserves Day but yields multiple Hour candidates", () => {
  const envelope = dayHourPillarEnvelopeFromUt1Estimate(
    statisticalEstimateAtLocalClock({ year:2026, month:9, day:13, hour:13, minute:0 }, 15 * 60),
    EXPLICIT_ZI_CONVENTION
  );

  assert.equal(envelope.day.uniqueWithinInterval, true);
  assert.equal(envelope.hour.uniqueWithinInterval, false);
  assert.equal(envelope.hour.candidateCount, 2);
  assert.equal(new Set(envelope.hour.candidates.map(item => item.branch)).size, 2);
});

test("Zi-initial day convention propagates a 23:00 crossing into both Day and Hour ambiguity", () => {
  const envelope = dayHourPillarEnvelopeFromUt1Estimate(
    statisticalEstimateAtLocalClock({ year:2026, month:9, day:13, hour:23, minute:0 }, 15 * 60),
    EXPLICIT_ZI_CONVENTION
  );

  assert.equal(envelope.day.uniqueWithinInterval, false);
  assert.equal(envelope.day.candidateCount, 2);
  assert.equal(envelope.hour.uniqueWithinInterval, false);
  assert.equal(envelope.hour.candidateCount, 2);
});

test("civil-midnight convention keeps Day unique across 23:00 while Hour remains ambiguous", () => {
  const envelope = dayHourPillarEnvelopeFromUt1Estimate(
    statisticalEstimateAtLocalClock({ year:2026, month:9, day:13, hour:23, minute:0 }, 15 * 60),
    { localOffsetHoursFromUt1:8, dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT }
  );

  assert.equal(envelope.day.uniqueWithinInterval, true);
  assert.equal(envelope.hour.uniqueWithinInterval, false);
  assert.equal(envelope.hour.candidateCount, 2);
});

test("year-4006 one-sigma Earth-rotation envelopes expose Hour ambiguity without pretending the one-sigma set is exhaustive", () => {
  const envelopes = seasonalEventsForCatalogueYear(4006).map(event => {
    const estimate = estimateDeepTimeUt1FromTtJulianDay(event.ttJulianDay);
    return dayHourPillarEnvelopeFromUt1Estimate(estimate, EXPLICIT_ZI_CONVENTION);
  });

  assert.equal(envelopes.length, 24);
  assert.ok(envelopes.every(result => result.interval.spanHours > 3));
  assert.ok(envelopes.every(result => result.interval.spanHours < 4));
  assert.ok(envelopes.every(result => result.hour.uniqueWithinInterval === false));
  assert.ok(envelopes.every(result => result.hour.candidateCount >= 2));
  assert.ok(envelopes.some(result => result.day.uniqueWithinInterval));
  assert.ok(envelopes.every(result => result.interval.hardBound === false));
  assert.ok(envelopes.every(result => result.unlocksDayHour === false));
});

test("convention binding is explicit and fails closed when omitted", () => {
  const estimate = statisticalEstimateAtLocalClock({ year:2026, month:9, day:13, hour:12 }, 60);
  assert.throws(
    () => dayHourPillarEnvelopeFromUt1Estimate(estimate, { dayBoundary:DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY }),
    /localOffsetHoursFromUt1 must be explicitly bound/
  );
  assert.throws(
    () => dayHourPillarEnvelopeFromUt1Estimate(estimate, { localOffsetHoursFromUt1:8 }),
    /dayBoundary must be explicitly bound/
  );
  assert.throws(
    () => dayHourPillarEnvelopeFromUt1Estimate(estimate, {
      localOffsetHoursFromUt1:8,
      dayBoundary:"future-school-default"
    }),
    /supported convention/
  );
});

test("bounded enumeration fails closed on malformed or excessively wide intervals", () => {
  const valid = statisticalEstimateAtLocalClock({ year:2026, month:9, day:13, hour:12 }, 60);
  assert.throws(() => dayHourPillarEnvelopeFromUt1Estimate({
    ...valid,
    oneSigmaUt1JulianDayMin:valid.ut1JulianDayEstimate + 1
  }, EXPLICIT_ZI_CONVENTION), /must lie inside/);

  const tooWide = statisticalEstimateAtLocalClock({ year:2026, month:9, day:13, hour:12 }, 90 * 60 * 60);
  assert.throws(() => dayHourPillarEnvelopeFromUt1Estimate(tooWide, EXPLICIT_ZI_CONVENTION), /bounded 168-hour/);
});

test("contract names the result as a statistical envelope rather than a deterministic bridge", () => {
  assert.equal(DAY_HOUR_UNCERTAINTY_ENVELOPE_CONTRACT.inputTimeScale, "UT1");
  assert.equal(DAY_HOUR_UNCERTAINTY_ENVELOPE_CONTRACT.supportedTimeBasis, "fixed-zone-from-ut1");
  assert.equal(DAY_HOUR_UNCERTAINTY_ENVELOPE_CONTRACT.requiresExplicitLocalOffset, true);
  assert.equal(DAY_HOUR_UNCERTAINTY_ENVELOPE_CONTRACT.requiresExplicitDayBoundary, true);
  assert.equal(DAY_HOUR_UNCERTAINTY_ENVELOPE_CONTRACT.deterministic, false);
  assert.equal(DAY_HOUR_UNCERTAINTY_ENVELOPE_CONTRACT.unlocksDayHour, false);
});