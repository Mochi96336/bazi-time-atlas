import test from "node:test";
import assert from "node:assert/strict";
import {
  createHorizons4006CatalogueFrameProofTransform,
  HORIZONS_4006_CATALOGUE_FRAME_KNOT_QUATERNIONS,
  HORIZONS_4006_CATALOGUE_FRAME_WINDOW
} from "../src/astronomy/horizons-ecliptic-frame-catalogue-window.js";
import { HORIZONS_ECLIPTIC_FRAME_EVIDENCE } from "../src/astronomy/horizons-ecliptic-frame-evidence.js";
import {
  roughSeasonalCrossingTtJulianDay,
  validateMeanEclipticOfDateTransform
} from "../src/astronomy/absolute-state-seasonal-solver.js";
import { sphericalDegreesToUnitVector } from "../src/astronomy/horizons-ecliptic-frame-window-proof.js";
import { HORIZONS_4006_CATALOGUE_FRAME_SELECTED_CASES } from "./fixtures/horizons-ecliptic-frame-catalogue-window.js";
import { SEASONAL_EPOCH_PIPELINE, seasonalEpochSourceAudit } from "../src/recurrence/seasonal-epoch-source-audit.js";

const ARCSEC_PER_RADIAN = 206264.80624709636;

function angularDistanceArcsec(a, b) {
  const cross = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  const crossMagnitude = Math.hypot(...cross);
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.atan2(crossMagnitude, dot) * ARCSEC_PER_RADIAN;
}

test("catalogue frame evidence supersedes the calendar-year-only capture", () => {
  const evidence = HORIZONS_ECLIPTIC_FRAME_EVIDENCE;
  assert.equal(evidence.researchPullRequest, 94);
  assert.equal(evidence.denseWindowResearchRunId, 34881697237);
  assert.equal(evidence.denseWindowArtifactId, 10363212590);
  assert.match(evidence.denseWindowArtifactDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(evidence.year4006CatalogueWindow.knotRows, 397);
  assert.equal(evidence.year4006CatalogueWindow.withheldRows, 396);
  assert.equal(evidence.year4006CatalogueWindow.previousDecemberCoverageValidated, true);
  assert.equal(evidence.year4006CatalogueWindow.exhaustiveHalfDaySweepValidated, true);
  assert.ok(evidence.year4006CatalogueWindow.maxAngularResidualArcsec < 0.01);
  assert.ok(evidence.year4006CatalogueWindow.maxEquivalentMeanAnnualSolarCrossingSeconds < 0.25);
  assert.match(evidence.supersededCalendarYearOnlyCapture.limitation, /previous-December/);
});

test("compact quaternion grid is a normalized daily catalogue window", () => {
  const window = HORIZONS_4006_CATALOGUE_FRAME_WINDOW;
  assert.equal(window.catalogueYear, 4006);
  assert.equal(window.knotCount, 397);
  assert.equal(HORIZONS_4006_CATALOGUE_FRAME_KNOT_QUATERNIONS.length, 397 * 4);
  assert.equal(window.startTtJulianDay, 3184190.5);
  assert.equal(window.endTtJulianDay, 3184586.5);
  for (let index = 0; index < HORIZONS_4006_CATALOGUE_FRAME_KNOT_QUATERNIONS.length; index += 4) {
    const norm = Math.hypot(
      HORIZONS_4006_CATALOGUE_FRAME_KNOT_QUATERNIONS[index],
      HORIZONS_4006_CATALOGUE_FRAME_KNOT_QUATERNIONS[index + 1],
      HORIZONS_4006_CATALOGUE_FRAME_KNOT_QUATERNIONS[index + 2],
      HORIZONS_4006_CATALOGUE_FRAME_KNOT_QUATERNIONS[index + 3]
    );
    assert.ok(Math.abs(norm - 1) < 2e-15, `knot ${index / 4}: ${norm}`);
  }
});

test("catalogue frame covers the bounded root brackets for all year-4006 terms", () => {
  const transform = createHorizons4006CatalogueFrameProofTransform();
  validateMeanEclipticOfDateTransform(transform);
  const marginDays = HORIZONS_ECLIPTIC_FRAME_EVIDENCE.year4006CatalogueWindow.maxRootBracketDays;
  for (let longitudeDegrees = 0; longitudeDegrees < 360; longitudeDegrees += 15) {
    const seed = roughSeasonalCrossingTtJulianDay({ year:4006, longitudeDegrees });
    assert.ok(seed - marginDays >= transform.coverageTtJulianDay[0],
      `${longitudeDegrees}° lower bracket ${seed - marginDays}`);
    assert.ok(seed + marginDays <= transform.coverageTtJulianDay[1],
      `${longitudeDegrees}° upper bracket ${seed + marginDays}`);
  }
});

test("daily quaternion SLERP reproduces selected previous-December and worst-region truth", () => {
  const transform = createHorizons4006CatalogueFrameProofTransform();
  let maxResidualArcsec = 0;
  for (const proofCase of HORIZONS_4006_CATALOGUE_FRAME_SELECTED_CASES) {
    for (const body of ["sun", "moon"]) {
      const source = sphericalDegreesToUnitVector(proofCase.truth[body].icrf);
      const expected = sphericalDegreesToUnitVector(proofCase.truth[body].ecliptic);
      const actual = transform.icrfDirectionToMeanEclipticOfDate({
        ttJulianDay:proofCase.jdTt,
        directionIcrf:source
      });
      const residualArcsec = angularDistanceArcsec(actual, expected);
      maxResidualArcsec = Math.max(maxResidualArcsec, residualArcsec);
      assert.ok(residualArcsec < 0.012,
        `${proofCase.label} ${body}: ${residualArcsec} arcsec`);
    }
  }
  assert.ok(maxResidualArcsec < 0.012);
});

test("catalogue frame transform fails closed outside its pinned evidence window", () => {
  const transform = createHorizons4006CatalogueFrameProofTransform();
  assert.throws(() => transform.matrixAtTtJulianDay(3184190.499), /no catalogue frame proof covers/);
  assert.throws(() => transform.matrixAtTtJulianDay(3184586.501), /no catalogue frame proof covers/);
  assert.doesNotThrow(() => transform.matrixAtTtJulianDay(3184190.5));
  assert.doesNotThrow(() => transform.matrixAtTtJulianDay(3184586.5));
});

test("full catalogue frame coverage still does not promote the production seasonal pipeline", () => {
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterIds, []);
  assert.equal(SEASONAL_EPOCH_PIPELINE.apparentGeocentricSolarLongitudeOfDate, false);
  assert.equal(SEASONAL_EPOCH_PIPELINE.crossingRootSolve, false);
  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006 });
  assert.equal(result.status, "qualified-ephemeris-basis-not-integrated");
  assert.equal(result.absoluteSeasonalEpochAvailable, false);
  assert.deepEqual(result.usableSourceIds, []);
});
