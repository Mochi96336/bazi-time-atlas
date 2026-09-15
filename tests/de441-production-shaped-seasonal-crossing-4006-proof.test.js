import test from "node:test";
import assert from "node:assert/strict";
import {
  ABSOLUTE_STATE_SEASONAL_REFERENCE_SEMANTICS,
  MEAN_ECLIPTIC_OF_DATE_FRAME_SEMANTICS,
  solveSeasonalCrossingFromAbsoluteState
} from "../src/astronomy/absolute-state-seasonal-solver.js";
import { createDe441StateSegmentProofAdapter } from "../src/astronomy/de441-state-segment-adapter.js";
import { ttJulianDayToTdbJulianDay } from "../src/astronomy/naif-tt-tdb-time-bridge.js";
import { createHorizonsEclipticFrameWindowProofTransform } from "../src/astronomy/horizons-ecliptic-frame-transform-proof.js";
import { HORIZONS_SUN_APPARENT_DIRECTION_PROOF_MODEL } from "../src/astronomy/horizons-sun-apparent-direction-proof.js";
import { DE441_SEASONAL_CROSSING_4006_EVIDENCE } from "../src/astronomy/de441-seasonal-crossing-evidence.js";
import { DE441_SEASONAL_EVENT_DATA_PROVIDER } from "../src/astronomy/de441-seasonal-event-data-product.js";
import { DE441_SEASONAL_CROSSING_4006_FIXTURE } from "./fixtures/de441-seasonal-crossing-4006-proof.js";
import { SEASONAL_EPOCH_PIPELINE, seasonalEpochSourceAudit } from "../src/recurrence/seasonal-epoch-source-audit.js";

const SECONDS_PER_DAY = 86400;
const DE441_EVENT_PROVIDER_ID = DE441_SEASONAL_EVENT_DATA_PROVIDER.id;

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

function createProductionShapedProofComponents() {
  const fixture = DE441_SEASONAL_CROSSING_4006_FIXTURE;
  const stateAdapter = createDe441StateSegmentProofAdapter({
    id:"jpl-de441-4006-production-shaped-proof",
    windows:fixture.stateWindows,
    provenance:fixture.stateProvenance,
    ttToTdbJulianDay:ttJulianDayToTdbJulianDay
  });
  const frameTransform = createHorizonsEclipticFrameWindowProofTransform({
    id:"horizons-4006-production-shaped-frame-proof",
    windows:fixture.frameWindows.map(window => ({
      startJdTt:window.startJdTt,
      endJdTt:window.endJdTt,
      startMatrix:quaternionToMatrix(window.startQuaternion),
      endMatrix:quaternionToMatrix(window.endQuaternion)
    })),
    provenance:fixture.frameProvenance
  });
  return { stateAdapter, frameTransform };
}

test("mean-ecliptic-of-date contract is model-neutral across modern and deep-time frame implementations", () => {
  assert.equal(MEAN_ECLIPTIC_OF_DATE_FRAME_SEMANTICS, "earth-mean-ecliptic-of-date");
});

test("production-shaped absolute-state solver recovers all 24 year-4006 Horizons crossings", () => {
  const fixture = DE441_SEASONAL_CROSSING_4006_FIXTURE;
  const { stateAdapter, frameTransform } = createProductionShapedProofComponents();
  const corrections = Object.freeze({
    apparentDirectionModel:HORIZONS_SUN_APPARENT_DIRECTION_PROOF_MODEL,
    lightTime:true,
    lightTimeIterations:3
  });

  const errorsSeconds = fixture.crossings.map(crossing => {
    const solved = solveSeasonalCrossingFromAbsoluteState({
      year:4006,
      longitudeDegrees:crossing.longitudeDegrees,
      stateAdapter,
      frameTransform,
      seedTtJulianDay:crossing.shouXingSeedTtJulianDay,
      initialHalfBracketDays:fixture.initialHalfBracketDays,
      maxHalfBracketDays:fixture.initialHalfBracketDays,
      toleranceSeconds:fixture.toleranceSeconds,
      corrections
    });

    assert.equal(solved.referenceSemantics, ABSOLUTE_STATE_SEASONAL_REFERENCE_SEMANTICS);
    assert.equal(solved.apparentModelComplete, true);
    assert.equal(solved.apparentDirectionModelId, HORIZONS_SUN_APPARENT_DIRECTION_PROOF_MODEL.id);
    assert.equal(solved.frameTransformId, frameTransform.id);
    assert.equal(solved.bracketHalfWidthDays, fixture.initialHalfBracketDays);
    return (solved.ttJulianDay - crossing.horizonsTruthTtJulianDay) * SECONDS_PER_DAY;
  });

  const absoluteErrors = errorsSeconds.map(Math.abs);
  const maxAbsEpochErrorSeconds = Math.max(...absoluteErrors);
  const meanAbsEpochErrorSeconds = absoluteErrors.reduce((sum, value) => sum + value, 0) / absoluteErrors.length;

  assert.equal(errorsSeconds.length, 24);
  assert.ok(maxAbsEpochErrorSeconds < DE441_SEASONAL_CROSSING_4006_EVIDENCE.proofResult.promotionBudgetSeconds);
  assert.ok(maxAbsEpochErrorSeconds < 0.25, `production-shaped max error ${maxAbsEpochErrorSeconds} s`);
  assert.ok(meanAbsEpochErrorSeconds < 0.1, `production-shaped mean error ${meanAbsEpochErrorSeconds} s`);
});

test("production-shaped state proof remains separate from the bounded direct-event runtime", () => {
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterIds, []);
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterRuntimeCoverageById, {});
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.directEventProviderIds, [DE441_EVENT_PROVIDER_ID]);
  assert.equal(SEASONAL_EPOCH_PIPELINE.apparentGeocentricSolarLongitudeOfDate, false);
  assert.equal(SEASONAL_EPOCH_PIPELINE.crossingRootSolve, false);
  const audit = seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006 });
  assert.equal(audit.status, "resolved");
  assert.equal(audit.absoluteSeasonalEpochAvailable, true);
  assert.deepEqual(audit.usableSourceIds, [DE441_EVENT_PROVIDER_ID]);
});
