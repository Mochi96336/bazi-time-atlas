import test from "node:test";
import assert from "node:assert/strict";
import { monthBoundaryDisagreementExposure } from "../src/recurrence/month-boundary-risk.js";

test("same-year comparison has no month-boundary disagreement window", () => {
  const exposure = monthBoundaryDisagreementExposure(2026, 2026);
  assert.equal(exposure.windows.length, 12);
  assert.ok(exposure.windows.every(window => Math.abs(window.widthHours) < 1e-9));
  assert.ok(exposure.unionExposureHours < 1e-9);
  assert.ok(exposure.yearPercent < 1e-9);
  assert.equal(exposure.closed, true);
});

test("24000-year exact discrete closure still sweeps substantial month-boundary time", () => {
  const exposure = monthBoundaryDisagreementExposure(2026, 26026);
  assert.equal(exposure.windows.length, 12);
  assert.equal(exposure.mergedWindows.length, 12);
  assert.ok(exposure.unionExposureHours > 500);
  assert.ok(exposure.yearPercent > 5 && exposure.yearPercent < 10);
  assert.ok(exposure.largestWindow.widthHours > 95 && exposure.largestWindow.widthHours < 96);
  assert.equal(exposure.closed, false);
});

test("792000-year near recurrence reduces month-boundary disagreement exposure", () => {
  const first = monthBoundaryDisagreementExposure(2026, 26026);
  const near = monthBoundaryDisagreementExposure(2026, 794026);
  assert.equal(near.windows.length, 12);
  assert.equal(near.mergedWindows.length, 12);
  assert.ok(near.unionExposureHours > 0);
  assert.ok(near.unionExposureHours < first.unionExposureHours);
  assert.ok(near.yearPercent < first.yearPercent);
  assert.ok(near.largestWindow.widthHours > 10 && near.largestWindow.widthHours < 11);
});

test("window direction preserves whether the target jie moved earlier or later", () => {
  const exposure = monthBoundaryDisagreementExposure(2026, 4006);
  assert.ok(exposure.windows.some(window => window.direction === "target-earlier"));
  assert.ok(exposure.windows.some(window => window.direction === "target-later"));
  for (const window of exposure.windows) {
    assert.ok(window.endDay >= window.startDay);
    assert.ok(Math.abs(window.widthHours - Math.abs(window.residualHours)) < 1e-9);
  }
});