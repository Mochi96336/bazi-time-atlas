// Proof-only differential: this file must not widen runtime or recurrence authority.
import test from "node:test";
import assert from "node:assert/strict";
import { JulianDay } from "../vendor/tyme4ts-1.5.2.mjs";
import {
  equationOfTime,
  meanObliquityDegrees,
  sunMeanLongitudeDegrees
} from "../src/astronomy/equation-of-time.js";
import {
  DE441_SEASONAL_EVENT_SOURCE_EVIDENCE,
  seasonalEventsForCatalogueYear
} from "../src/astronomy/de441-seasonal-event-data-product.js";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const APPARENT_MEAN_LONGITUDE_CORRECTION_DEGREES = 0.0057183;
const MAX_ERROR_SECONDS = 5;

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function wrapEquationMinutes(minutes) {
  let value = minutes;
  while (value > 20) value -= 1440;
  while (value < -20) value += 1440;
  return value;
}

function meanEquatorRightAscensionDegrees(longitudeDegrees, obliquityDegrees) {
  const lambda = longitudeDegrees * DEG_TO_RAD;
  const epsilon = obliquityDegrees * DEG_TO_RAD;
  return normalizeDegrees(Math.atan2(
    Math.cos(epsilon) * Math.sin(lambda),
    Math.cos(lambda)
  ) * RAD_TO_DEG);
}

function ttClockFields(ttJulianDay) {
  const time = JulianDay.fromJulianDay(ttJulianDay).getSolarTime();
  return {
    year:time.getYear(),
    month:time.getMonth(),
    day:time.getDay(),
    hour:time.getHour(),
    minute:time.getMinute(),
    second:time.getSecond()
  };
}

/**
 * Independent direction side of the Equation-of-Time check.
 *
 * Each event is a pinned NASA/JPL Horizons quantity-31 crossing in the Earth
 * mean-ecliptic-of-date frame, so its apparent geocentric solar longitude is
 * exactly the canonical 15-degree target at the recorded TT epoch. Converting
 * that mean-ecliptic direction to the mean equator lets the standard SPA A1
 * expression be written without the production ShouXing apparent-longitude /
 * nutation path: E = L0 - 0.0057183 - alpha_mean.
 *
 * Solar ecliptic latitude is intentionally approximated as zero here. It is a
 * tiny second-order term for the Sun and the acceptance budget is deliberately
 * seconds rather than sub-second. This proof qualifies the crossing-epoch
 * differential only; it does not by itself register all of year 4006 as EoT
 * recurrence authority.
 */
function horizonsCrossingReferenceMinutes(event) {
  const jme = (event.ttJulianDay - JulianDay.J2000) / 365250;
  const meanLongitudeDegrees = sunMeanLongitudeDegrees(jme);
  const obliquityDegrees = meanObliquityDegrees(jme);
  const rightAscensionDegrees = meanEquatorRightAscensionDegrees(
    event.longitudeDegrees,
    obliquityDegrees
  );
  return wrapEquationMinutes((
    meanLongitudeDegrees
    - APPARENT_MEAN_LONGITUDE_CORRECTION_DEGREES
    - rightAscensionDegrees
  ) * 4);
}

test("year-4006 EoT follows all 24 pinned Horizons/DE441 seasonal crossings", () => {
  const evidence = DE441_SEASONAL_EVENT_SOURCE_EVIDENCE;
  assert.equal(evidence.authority, "NASA/JPL Horizons");
  assert.equal(evidence.sourceEphemeris, "DE441");
  assert.equal(evidence.quantity, "31 · observer-centered Earth ecliptic longitude/latitude");
  assert.equal(
    evidence.referenceSemantics,
    "geocentric-apparent-solar-longitude-mean-ecliptic-of-date"
  );
  assert.equal(evidence.catalogueYear, 4006);
  assert.equal(evidence.crossings, 24);
  assert.match(evidence.sourceCaptureSha256, /^[0-9a-f]{64}$/);

  const events = seasonalEventsForCatalogueYear(4006);
  assert.equal(events.length, 24);
  assert.equal(new Set(events.map(event => event.longitudeDegrees)).size, 24);

  let maxErrorSeconds = 0;
  let totalErrorSeconds = 0;
  let worst = null;

  for (const event of events) {
    const actualMinutes = equationOfTime(
      ttClockFields(event.ttJulianDay),
      0,
      { deltaTSeconds:0 }
    ).minutes;
    const referenceMinutes = horizonsCrossingReferenceMinutes(event);
    const errorSeconds = Math.abs(actualMinutes - referenceMinutes) * 60;

    totalErrorSeconds += errorSeconds;
    if (errorSeconds > maxErrorSeconds) {
      maxErrorSeconds = errorSeconds;
      worst = { event, actualMinutes, referenceMinutes, errorSeconds };
    }
  }

  const meanErrorSeconds = totalErrorSeconds / events.length;
  console.log(
    `[eot-4006-crossing-proof] max=${maxErrorSeconds.toFixed(6)}s `
      + `mean=${meanErrorSeconds.toFixed(6)}s `
      + `worst=${worst?.event.name}/${worst?.event.longitudeDegrees}deg`
  );

  assert.ok(
    maxErrorSeconds < MAX_ERROR_SECONDS,
    `year-4006 EoT crossing differential exceeded ${MAX_ERROR_SECONDS}s: `
      + `${JSON.stringify(worst)}`
  );
});
