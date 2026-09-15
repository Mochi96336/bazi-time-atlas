import test from "node:test";
import assert from "node:assert/strict";
import { createDe441StateSegmentProofAdapter } from "../src/astronomy/de441-state-segment-adapter.js";
import { ttJulianDayToTdbJulianDay } from "../src/astronomy/naif-tt-tdb-time-bridge.js";
import { createHorizonsEclipticFrameWindowProofAdapter } from "../src/astronomy/horizons-ecliptic-frame-window-proof.js";
import { createDe441SeasonalCrossingProofChain } from "../src/astronomy/de441-seasonal-crossing-proof.js";
import { DE441_SEASONAL_CROSSING_4006_EVIDENCE } from "../src/astronomy/de441-seasonal-crossing-evidence.js";
import { DE441_SEASONAL_CROSSING_4006_FIXTURE } from "./fixtures/de441-seasonal-crossing-4006-proof.js";

const SECONDS_PER_DAY = 86400;
const ARCSEC_PER_DEGREE = 3600;

function quaternionToMatrix(quaternion) {
  const magnitude = Math.hypot(...quaternion);
  const [w, x, y, z] = quaternion.map(value => value / magnitude);
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  return [
    [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy)],
    [2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx)],
    [2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)]
  ];
}

function fixtureFrameWindowsAsMatrices(windows) {
  return windows.map(window => ({
    term:window.term,
    startJdTt:window.startJdTt,
    endJdTt:window.endJdTt,
    startMatrix:quaternionToMatrix(window.startQuaternion),
    endMatrix:quaternionToMatrix(window.endQuaternion)
  }));
}

function createProofChain() {
  const fixture = DE441_SEASONAL_CROSSING_4006_FIXTURE;
  const stateAdapter = createDe441StateSegmentProofAdapter({
    id:"jpl-de441-4006-seasonal-crossing-local-windows-proof",
    windows:fixture.stateWindows,
    provenance:fixture.stateProvenance,
    ttToTdbJulianDay:ttJulianDayToTdbJulianDay
  });
  const frameAdapter = createHorizonsEclipticFrameWindowProofAdapter({
    id:"horizons-4006-seasonal-crossing-local-frame-proof",
    windows:fixtureFrameWindowsAsMatrices(fixture.frameWindows),
    provenance:fixture.frameProvenance
  });
  return createDe441SeasonalCrossingProofChain({ stateAdapter, frameAdapter });
}

test("4006 end-to-end fixture stays compact and independently seeded", () => {
  const fixture = DE441_SEASONAL_CROSSING_4006_FIXTURE;
  assert.equal(fixture.crossings.length, 24);
  assert.equal(fixture.stateWindows.reduce((sum, window) => sum + window.sampleCount, 0), 50);
  assert.equal(fixture.frameWindows.length, 26);
  assert.equal(fixture.initialHalfBracketDays, 0.05);
  assert.equal(fixture.toleranceSeconds, 0.005);

  for (const crossing of fixture.crossings) {
    assert.ok(
      Math.abs(crossing.shouXingSeedTtJulianDay - crossing.horizonsTruthTtJulianDay) * SECONDS_PER_DAY > 250,
      `${crossing.name} seed must remain the independently wrong ShouXing candidate rather than JPL truth`
    );
  }
});

test("DE441 chain recovers all 24 year-4006 Horizons quantity-31 crossings", () => {
  const fixture = DE441_SEASONAL_CROSSING_4006_FIXTURE;
  const chain = createProofChain();
  const results = fixture.crossings.map(crossing => {
    const solved = chain.solveCrossing({
      longitudeDegrees:crossing.longitudeDegrees,
      seedTtJulianDay:crossing.shouXingSeedTtJulianDay,
      initialHalfBracketDays:fixture.initialHalfBracketDays,
      toleranceSeconds:fixture.toleranceSeconds
    });
    const epochErrorSeconds = (solved.ttJulianDay - crossing.horizonsTruthTtJulianDay) * SECONDS_PER_DAY;
    const truthLongitude = chain.solarLongitudeAtTtJulianDay(crossing.horizonsTruthTtJulianDay);
    const longitudeDelta = ((truthLongitude.longitudeDegrees - crossing.longitudeDegrees + 540) % 360) - 180;
    return {
      ...crossing,
      solved,
      epochErrorSeconds,
      truthLongitudeResidualArcsec:Math.abs(longitudeDelta) * ARCSEC_PER_DEGREE
    };
  });

  assert.equal(results.length, 24);
  const maxEpochErrorSeconds = Math.max(...results.map(item => Math.abs(item.epochErrorSeconds)));
  const meanAbsEpochErrorSeconds = results.reduce(
    (sum, item) => sum + Math.abs(item.epochErrorSeconds),
    0
  ) / results.length;
  const maxTruthLongitudeResidualArcsec = Math.max(
    ...results.map(item => item.truthLongitudeResidualArcsec)
  );

  assert.ok(maxEpochErrorSeconds <= 0.17, `max epoch error ${maxEpochErrorSeconds}s`);
  assert.ok(meanAbsEpochErrorSeconds <= 0.07, `mean absolute epoch error ${meanAbsEpochErrorSeconds}s`);
  assert.ok(maxTruthLongitudeResidualArcsec <= 0.007, `max longitude truth residual ${maxTruthLongitudeResidualArcsec} arcsec`);
  assert.ok(maxEpochErrorSeconds < DE441_SEASONAL_CROSSING_4006_EVIDENCE.proofResult.promotionBudgetSeconds);
});

test("end-to-end proof remains fail-closed outside its local evidence windows", () => {
  const chain = createProofChain();
  assert.throws(
    () => chain.solarLongitudeAtTtJulianDay(3184307.0),
    /outside pinned DE441 proof windows|no proof frame window covers/
  );
  assert.equal(chain.proofOnly, true);
  assert.equal(chain.productionIntegrated, false);
  assert.equal(DE441_SEASONAL_CROSSING_4006_EVIDENCE.promotionBoundary.productionSeasonalPipelineIntegrated, false);
  assert.equal(DE441_SEASONAL_CROSSING_4006_EVIDENCE.promotionBoundary.productionYear4006Unlocked, false);
});
