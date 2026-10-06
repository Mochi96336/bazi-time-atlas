import test from "node:test";
import assert from "node:assert/strict";
import {
  LONG_RANGE_SEASONAL_PHASE_PROXY_CONTRACT,
  assessSeasonalPhaseProxy,
  seasonalEventUniformTimeProxy
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
  assert.ok(Number.isFinite(assessment.validation.errorHours));
  assert.ok(assessment.validation.absoluteErrorHours >= 0);
  assert.equal(assessment.proxyIsAbsoluteAuthority, false);

  console.log(`[seasonal-phase-proxy] 4006 LiChun error = ${assessment.validation.errorHours.toFixed(3)} h`);
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
  assert.ok(Number.isFinite(assessment.validation.errorHours));

  console.log(`[seasonal-phase-proxy] 10026 LiChun error = ${assessment.validation.errorHours.toFixed(3)} h`);
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
  assert.ok(assessment.earthRotation.deltaTPointEstimateDays > 20);
  assert.ok(assessment.earthRotation.oneSigmaDays > 7);

  console.log(
    `[seasonal-phase-proxy] 26026 proxy TT JD = ${assessment.proxy.ttJulianDay.toFixed(6)}; `
    + `DeltaT point = ${assessment.earthRotation.deltaTPointEstimateDays.toFixed(3)} d; `
    + `1sigma = ${assessment.earthRotation.oneSigmaDays.toFixed(3)} d`
  );
});
