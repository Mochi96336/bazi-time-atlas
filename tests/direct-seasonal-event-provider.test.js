import test from "node:test";
import assert from "node:assert/strict";
import { JulianDay, ShouXingUtil } from "../vendor/tyme4ts-1.5.2.mjs";
import { solarTermEventForCivilYear } from "../src/astronomy/solar-term-boundaries.js";
import {
  TYME_SHOUXING_DIRECT_PROVIDER,
  solveSolarLongitude
} from "../src/astronomy/direct-seasonal-event-provider.js";
import { solarTerms } from "../src/data.js";
import { seasonalEpochProviderAvailability } from "../src/recurrence/seasonal-epoch-provider.js";

const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2_440_587.5;
const MAX_SOLVER_RESIDUAL_DEGREES = 1e-6; // < 0.004 arcsec; matches the pinned ShouXing inverse solver precision.

function ttJulianDayFromUtcMillis(instantMs) {
  const utcJulianDay = UNIX_EPOCH_JD + instantMs / DAY_MS;
  const utcDaysFromJ2000 = utcJulianDay - JulianDay.J2000;
  return utcJulianDay + ShouXingUtil.dtT(utcDaysFromJ2000);
}

test("direct provider is explicit TT seasonal-event provenance, not a state-vector source", () => {
  assert.equal(TYME_SHOUXING_DIRECT_PROVIDER.role, "direct-seasonal-event");
  assert.equal(TYME_SHOUXING_DIRECT_PROVIDER.timeScale, "TT");
  assert.equal(TYME_SHOUXING_DIRECT_PROVIDER.capabilities.directSeasonalEpoch, true);
  assert.equal(TYME_SHOUXING_DIRECT_PROVIDER.capabilities.continuousDynamicalTime, true);
  assert.equal(TYME_SHOUXING_DIRECT_PROVIDER.capabilities.absoluteStateVector, false);
  assert.deepEqual(TYME_SHOUXING_DIRECT_PROVIDER.coverage, {
    mode:"absolute-year",
    minYear:1900,
    maxYear:2100
  });
});

test("direct provider contract becomes usable without pretending the app has a DE441 state adapter or crossing solver", () => {
  const providerId = TYME_SHOUXING_DIRECT_PROVIDER.id;
  const pipeline = Object.freeze({
    absoluteStateAdapterIds:Object.freeze([]),
    directEventProviderIds:Object.freeze([providerId]),
    apparentGeocentricSolarLongitudeOfDate:false,
    crossingRootSolve:false
  });
  const result = seasonalEpochProviderAvailability(TYME_SHOUXING_DIRECT_PROVIDER, 2026, pipeline);

  assert.equal(result.usableNow, true);
  assert.equal(result.directProviderIntegrated, true);
  assert.equal(result.stateAdapterIntegrated, false);
  assert.equal(result.deepTimeSolverReady, false);
  assert.equal(result.reason, "usable");
});

test("solveSolarLongitude reproduces all 24 pinned Tyme 2026 solar-term epochs on TT", () => {
  for (const term of solarTerms) {
    const solved = solveSolarLongitude({ year:2026, longitudeDegrees:term.longitude });
    const reference = solarTermEventForCivilYear(2026, term.name);
    const referenceTtJulianDay = ttJulianDayFromUtcMillis(reference.instantMs);
    const errorSeconds = Math.abs(solved.ttJulianDay - referenceTtJulianDay) * 86400;

    assert.equal(solved.timeScale, "TT", term.name);
    assert.equal(Object.hasOwn(solved, "instantMs"), false, term.name);
    assert.ok(
      solved.residualDegrees < MAX_SOLVER_RESIDUAL_DEGREES,
      `${term.name} residual ${solved.residualDegrees}`
    );
    assert.ok(errorSeconds <= 2, `${term.name} TT error ${errorSeconds.toFixed(6)} s`);
  }
});

test("solveSolarLongitude is not limited to named 15-degree terms", () => {
  const solved = solveSolarLongitude({ year:2026, longitudeDegrees:17.5 });
  assert.equal(solved.targetLongitudeDegrees, 17.5);
  assert.ok(solved.residualDegrees < MAX_SOLVER_RESIDUAL_DEGREES);
});

test("direct proof stays fail-closed outside its validated coverage", () => {
  assert.throws(
    () => solveSolarLongitude({ year:4006, longitudeDegrees:315 }),
    /validated direct-provider coverage/
  );
  assert.throws(
    () => solveSolarLongitude({ year:26026, longitudeDegrees:315 }),
    /validated direct-provider coverage/
  );
});
