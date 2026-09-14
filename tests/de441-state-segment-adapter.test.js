import test from "node:test";
import assert from "node:assert/strict";
import { createDe441StateSegmentProofAdapter } from "../src/astronomy/de441-state-segment-adapter.js";
import { DE441_STATE_INTERPOLATION_EVIDENCE } from "../src/astronomy/de441-state-interpolation-evidence.js";
import {
  DE441_SEGMENT_PROOF_CASES,
  DE441_SEGMENT_PROOF_PROVENANCE
} from "./fixtures/de441-state-segment-proof.js";
import {
  SEASONAL_EPOCH_PIPELINE,
  seasonalEpochSourceAudit
} from "../src/recurrence/seasonal-epoch-source-audit.js";

const AU_METERS = 149_597_870_700;
const SECONDS_PER_DAY = 86400;

function vectorError(a, b, scale = 1) {
  return Math.hypot(
    (a[0] - b[0]) * scale,
    (a[1] - b[1]) * scale,
    (a[2] - b[2]) * scale
  );
}

function identityTestTtToTdb(ttJulianDay) {
  // Test-only: isolates interpolation on the already-TDB state axis.
  return ttJulianDay;
}

function adapterForCase(proofCase) {
  return createDe441StateSegmentProofAdapter({
    id:`proof-${proofCase.id}`,
    windows:[proofCase.window],
    provenance:DE441_SEGMENT_PROOF_PROVENANCE,
    ttToTdbJulianDay:identityTestTtToTdb
  });
}

test("pinned interpolation evidence is real DE441 ICRF/TDB geometric state data", () => {
  const evidence = DE441_STATE_INTERPOLATION_EVIDENCE;
  assert.equal(evidence.authority, "NASA/JPL Horizons API");
  assert.equal(evidence.sourceEphemeris, "DE441");
  assert.equal(evidence.vectorContract.referenceFrame, "ICRF");
  assert.equal(evidence.vectorContract.timeScale, "TDB");
  assert.equal(evidence.vectorContract.corrections, "NONE");
  assert.match(evidence.artifactDigest, /^sha256:[0-9a-f]{64}$/);
  for (const digest of Object.values(evidence.rawFileSha256)) {
    assert.match(digest, /^[0-9a-f]{64}$/);
  }
});

test("proof adapter requires explicit DE441 provenance and TT to TDB conversion", () => {
  const window = DE441_SEGMENT_PROOF_CASES[0].window;
  assert.throws(() => createDe441StateSegmentProofAdapter({
    windows:[window],
    provenance:DE441_SEGMENT_PROOF_PROVENANCE
  }), /ttToTdbJulianDay/);
  assert.throws(() => createDe441StateSegmentProofAdapter({
    windows:[window],
    provenance:{ ...DE441_SEGMENT_PROOF_PROVENANCE, sourceEphemeris:"DE440" },
    ttToTdbJulianDay:identityTestTtToTdb
  }), /DE441 provenance/);
});

test("real DE441 endpoint states are reproduced exactly", () => {
  for (const proofCase of DE441_SEGMENT_PROOF_CASES) {
    const adapter = adapterForCase(proofCase);
    assert.equal(adapter.providerId, "jpl-de441");
    assert.equal(adapter.referenceFrame, "ICRF");
    assert.equal(adapter.ephemerisTimeScale, "TDB");
    assert.equal(adapter.proofOnly, true);
    assert.equal(adapter.productionIntegrated, false);

    for (const index of [0, 1]) {
      const state = adapter.stateAtEphemerisJulianDay(
        proofCase.window.startTdbJulianDay + index
      );
      for (const body of ["earth", "sun"]) {
        const offset = index * 6;
        assert.deepEqual(state[body].positionAu,
          proofCase.window[body].slice(offset, offset + 3));
        assert.deepEqual(state[body].velocityAuPerDay,
          proofCase.window[body].slice(offset + 3, offset + 6));
      }
    }
  }
});

test("withheld Horizons midpoint truth validates cubic Hermite interpolation", () => {
  for (const proofCase of DE441_SEGMENT_PROOF_CASES) {
    const adapter = adapterForCase(proofCase);
    const interpolated = adapter.stateAtEphemerisJulianDay(proofCase.truth.tdbJulianDay);
    for (const body of ["earth", "sun"]) {
      const truthPosition = proofCase.truth[body].slice(0, 3);
      const truthVelocity = proofCase.truth[body].slice(3, 6);
      const positionErrorMeters = vectorError(
        interpolated[body].positionAu,
        truthPosition,
        AU_METERS
      );
      const velocityErrorMetersPerSecond = vectorError(
        interpolated[body].velocityAuPerDay,
        truthVelocity,
        AU_METERS / SECONDS_PER_DAY
      );
      if (body === "earth") {
        assert.ok(positionErrorMeters < 125,
          `${proofCase.id}: Earth position error ${positionErrorMeters} m`);
        assert.ok(velocityErrorMetersPerSecond < 0.00007,
          `${proofCase.id}: Earth velocity error ${velocityErrorMetersPerSecond} m/s`);
      } else {
        assert.ok(positionErrorMeters < 0.01,
          `${proofCase.id}: Sun position error ${positionErrorMeters} m`);
        assert.ok(velocityErrorMetersPerSecond < 0.000000003,
          `${proofCase.id}: Sun velocity error ${velocityErrorMetersPerSecond} m/s`);
      }
    }
  }
});

test("exhaustive 395-midpoint research sweep stays below the pinned state budget", () => {
  const exhaustive = DE441_STATE_INTERPOLATION_EVIDENCE.exhaustive;
  for (const year of [2026, 4006]) {
    assert.equal(exhaustive[year].earth.sampleCount, 395);
    assert.equal(exhaustive[year].sun.sampleCount, 395);
    assert.ok(exhaustive[year].earth.maxPositionErrorMeters < 100);
    assert.ok(exhaustive[year].earth.maxVelocityErrorMetersPerSecond < 0.00006);
    assert.ok(exhaustive[year].sun.maxPositionErrorMeters < 0.004);
    assert.ok(exhaustive[year].sun.maxVelocityErrorMetersPerSecond < 0.000000002);
  }

  const angularErrorRadians = 125 / AU_METERS;
  const meanSolarAngularRateRadiansPerSecond = Math.PI * 2 / (365.2422 * SECONDS_PER_DAY);
  assert.ok(angularErrorRadians / meanSolarAngularRateRadiansPerSecond < 0.005);
});

test("proof adapter fails closed outside its pinned state windows", () => {
  const proofCase = DE441_SEGMENT_PROOF_CASES[0];
  const adapter = adapterForCase(proofCase);
  assert.throws(
    () => adapter.stateAtEphemerisJulianDay(proofCase.window.startTdbJulianDay - 0.001),
    /outside pinned DE441 proof windows/
  );
  assert.throws(
    () => adapter.stateAtEphemerisJulianDay(proofCase.window.startTdbJulianDay + 1.001),
    /outside pinned DE441 proof windows/
  );
});

test("state interpolation proof does not promote the production seasonal pipeline", () => {
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterIds, []);
  assert.equal(SEASONAL_EPOCH_PIPELINE.apparentGeocentricSolarLongitudeOfDate, false);
  assert.equal(SEASONAL_EPOCH_PIPELINE.crossingRootSolve, false);

  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006 });
  assert.equal(result.status, "qualified-ephemeris-basis-not-integrated");
  assert.equal(result.absoluteSeasonalEpochAvailable, false);
  assert.deepEqual(result.usableSourceIds, []);
});
