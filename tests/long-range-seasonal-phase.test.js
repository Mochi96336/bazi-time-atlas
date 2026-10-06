import test from "node:test";
import assert from "node:assert/strict";
import {
  LONG_RANGE_SEASONAL_PHASE_PROXY_CONTRACT,
  SEASONAL_ORBIT_CLOCK_CONTRACT,
  assessSeasonalOrbitClock,
  assessSeasonalPhaseProxy,
  calibrateSeasonalOrbitClock,
  seasonalEventUniformTimeProxy,
  seasonalOrbitClockTurns,
  unwrappedSeasonalEventMeanAnomalyTurns
} from "../src/recurrence/long-range-seasonal-phase.js";

const LI_CHUN = 315;

test("long-range seasonal phase proxy stays explicitly non-authoritative", () => {
  assert.equal(LONG_RANGE_SEASONAL_PHASE_PROXY_CONTRACT.role, "research-calibration-only");
  assert.equal(LONG_RANGE_SEASONAL_PHASE_PROXY_CONTRACT.resolvesAbsoluteOrbitalPhase, false);
  assert.equal(LONG_RANGE_SEASONAL_PHASE_PROXY_CONTRACT.resolvesCivilTime, false);
  assert.equal(LONG_RANGE_SEASONAL_PHASE_PROXY_CONTRACT.productionAuthorityGranted, false);
});

test("identity proxy preserves the supplied base TT epoch exactly", () => {
  const proxy = seasonalEventUniformTimeProxy({
    baseYear:2026,
    targetYear:2026,
    longitudeDegrees:LI_CHUN,
    baseTtJulianDay:2461075.5
  });
  assert.equal(proxy.ttJulianDay, 2461075.5);
  assert.equal(proxy.shapeCorrectionDays, 0);
});

test("proxy can be calibrated against year-4006 reviewed DE441 evidence", () => {
  const assessment = assessSeasonalPhaseProxy({
    baseYear:2026,
    targetYear:4006,
    longitudeDegrees:LI_CHUN
  });

  assert.equal(assessment.status, "proxy-with-target-evidence");
  assert.equal(assessment.targetBoundary.authorityClass, "reviewed-production-direct-event");
  assert.ok(Math.abs(assessment.validation.phaseOffsetHours - 12.199) < 0.01);
  assert.equal(assessment.proxyIsAbsoluteAuthority, false);
});

test("year-4006 calibration separates common seasonal phase from within-year shape", () => {
  const plusShapeErrors = [];
  const skeletonOnlyErrors = [];
  const minusShapeErrors = [];
  for (let longitudeDegrees = 0; longitudeDegrees < 360; longitudeDegrees += 15) {
    const assessment = assessSeasonalPhaseProxy({
      baseYear:2026,
      targetYear:4006,
      longitudeDegrees
    });
    assert.equal(assessment.status, "proxy-with-target-evidence", `${longitudeDegrees}°`);
    assert.equal(assessment.targetBoundary.authorityClass, "reviewed-production-direct-event", `${longitudeDegrees}°`);

    const actual = assessment.targetBoundary.ttJulianDay;
    const skeleton = assessment.baseBoundary.ttJulianDay + assessment.proxy.seasonalSkeletonDays;
    const shape = assessment.proxy.shapeCorrectionDays;
    plusShapeErrors.push((actual - (skeleton + shape)) * 24);
    skeletonOnlyErrors.push((actual - skeleton) * 24);
    minusShapeErrors.push((actual - (skeleton - shape)) * 24);
  }

  function stats(errors) {
    const meanHours = errors.reduce((sum, value) => sum + value, 0) / errors.length;
    const minHours = Math.min(...errors);
    const maxHours = Math.max(...errors);
    const spreadHours = maxHours - minHours;
    const rmsAroundMeanHours = Math.sqrt(
      errors.reduce((sum, value) => sum + (value - meanHours) ** 2, 0) / errors.length
    );
    return { meanHours, minHours, maxHours, spreadHours, rmsAroundMeanHours };
  }

  const plus = stats(plusShapeErrors);
  const none = stats(skeletonOnlyErrors);
  const minus = stats(minusShapeErrors);

  assert.equal(plusShapeErrors.length, 24);
  assert.ok(Math.abs(plus.meanHours - 12.104) < 0.01);
  assert.ok(plus.spreadHours < 0.25);
  assert.ok(plus.rmsAroundMeanHours < 0.1);
  assert.ok(none.spreadHours > 50);
  assert.ok(none.rmsAroundMeanHours > 18);
  assert.ok(minus.spreadHours > 100);
  assert.ok(minus.rmsAroundMeanHours > 37);
});

test("proxy can be stress-tested against pinned year-10026 DE441-derived evidence without promoting it", () => {
  const assessment = assessSeasonalPhaseProxy({
    baseYear:2026,
    targetYear:10026,
    longitudeDegrees:LI_CHUN
  });

  assert.equal(assessment.status, "proxy-with-target-evidence");
  assert.equal(assessment.targetBoundary.authorityClass, "source-derived-research-evidence");
  assert.equal(assessment.validation.independentTargetYearTruth, false);
  assert.equal(assessment.validation.productionAuthorityGranted, false);
  assert.ok(Math.abs(assessment.validation.phaseOffsetHours - 33.118) < 0.01);
});

test("year 26026 remains proxy-only and exposes the separate Earth-rotation uncertainty", () => {
  const assessment = assessSeasonalPhaseProxy({
    baseYear:2026,
    targetYear:26026,
    longitudeDegrees:LI_CHUN
  });

  assert.equal(assessment.status, "proxy-only-absolute-source-gap");
  assert.equal(assessment.targetBoundary.status, "absolute-source-unavailable");
  assert.equal(assessment.blocker, "ephemeris-source-coverage");
  assert.equal(assessment.validation, null);
  assert.ok(Number.isFinite(assessment.proxy.ttJulianDay));
  assert.equal(assessment.proxyIsAbsoluteAuthority, false);
  assert.equal(assessment.civilTimeResolved, false);
  assert.ok(Math.abs(assessment.earthRotation.deltaTPointEstimateDays - 21.701) < 0.001);
  assert.ok(Math.abs(assessment.earthRotation.oneSigmaDays - 7.128) < 0.001);
});


test("seasonal orbit clock follows anomaly phase continuously instead of losing full precession turns", () => {
  const short = unwrappedSeasonalEventMeanAnomalyTurns({
    baseYear:2026,
    targetYear:4006,
    longitudeDegrees:LI_CHUN
  });
  const deep = unwrappedSeasonalEventMeanAnomalyTurns({
    baseYear:2026,
    targetYear:26026,
    longitudeDegrees:LI_CHUN
  });
  assert.ok(Number.isFinite(short));
  assert.ok(Number.isFinite(deep));
  assert.ok(Math.abs(short) < 0.5);
  assert.ok(Math.abs(deep) > Math.abs(short));
  assert.ok(Math.abs(seasonalOrbitClockTurns({
    baseYear:2026,
    targetYear:26026,
    longitudeDegrees:LI_CHUN
  }) - 24_000) < 2);
});

test("year-4006 reviewed 24-term evidence calibrates one common orbit clock", () => {
  const calibration = calibrateSeasonalOrbitClock({
    baseYear:2026,
    calibrationYear:4006
  });
  assert.equal(SEASONAL_ORBIT_CLOCK_CONTRACT.productionAuthorityGranted, false);
  assert.equal(calibration.status, "calibrated");
  assert.equal(calibration.sampleCount, 24);
  assert.ok(calibration.meanDaysPerOrbitTurn > 365.2);
  assert.ok(calibration.meanDaysPerOrbitTurn < 365.3);
  assert.ok(Number.isFinite(calibration.spreadSeconds));
  assert.ok(Number.isFinite(calibration.rmsSpreadSeconds));
  console.log(
    `[seasonal-orbit-clock] 2026→4006 P = ${calibration.meanDaysPerOrbitTurn.toFixed(9)} d; `
    + `24-term spread = ${calibration.spreadSeconds.toFixed(3)} s; RMS = ${calibration.rmsSpreadSeconds.toFixed(3)} s`
  );
});

test("4006-calibrated orbit clock predicts the pinned year-10026 Li Chun without refitting", () => {
  const assessment = assessSeasonalOrbitClock({
    baseYear:2026,
    calibrationYear:4006,
    targetYear:10026,
    longitudeDegrees:LI_CHUN
  });
  assert.equal(assessment.status, "orbit-clock-with-target-evidence");
  assert.equal(assessment.targetBoundary.authorityClass, "source-derived-research-evidence");
  assert.equal(assessment.validation.independentTargetYearTruth, false);
  assert.ok(Number.isFinite(assessment.validation.proxyMinusTargetHours));
  assert.equal(assessment.productionAuthorityGranted, false);
  console.log(
    `[seasonal-orbit-clock] 10026 LiChun prediction error = ${assessment.validation.proxyMinusTargetHours.toFixed(3)} h`
  );
});

test("26026 orbit-clock estimate remains research-only without absolute ephemeris truth", () => {
  const assessment = assessSeasonalOrbitClock({
    baseYear:2026,
    calibrationYear:4006,
    targetYear:26026,
    longitudeDegrees:LI_CHUN
  });
  assert.equal(assessment.status, "orbit-clock-proxy-only");
  assert.equal(assessment.targetBoundary.status, "absolute-source-unavailable");
  assert.equal(assessment.validation, null);
  assert.equal(assessment.blocker, "ephemeris-source-coverage");
  assert.ok(Number.isFinite(assessment.proxy.ttJulianDay));
  assert.equal(assessment.productionAuthorityGranted, false);
  assert.equal(assessment.civilTimeResolved, false);
  console.log(
    `[seasonal-orbit-clock] 26026 LiChun proxy TT JD = ${assessment.proxy.ttJulianDay.toFixed(6)}; `
    + `orbit turns = ${assessment.proxy.orbitTurns.toFixed(9)}`
  );
});
