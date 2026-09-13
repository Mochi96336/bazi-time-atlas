import test from "node:test";
import assert from "node:assert/strict";
import { monthBoundaryDisagreementExposure } from "../src/recurrence/month-boundary-risk.js";

const EXPECTED_TRANSITIONS = [
  ["清明", "卯", "辰"],
  ["立夏", "辰", "巳"],
  ["芒種", "巳", "午"],
  ["小暑", "午", "未"],
  ["立秋", "未", "申"],
  ["白露", "申", "酉"],
  ["寒露", "酉", "戌"],
  ["立冬", "戌", "亥"],
  ["大雪", "亥", "子"],
  ["小寒", "子", "丑"],
  ["立春", "丑", "寅"],
  ["驚蟄", "寅", "卯"]
];

test("same-year comparison has no month-boundary disagreement window", () => {
  const exposure = monthBoundaryDisagreementExposure(2026, 2026);
  assert.equal(exposure.windows.length, 12);
  assert.ok(exposure.windows.every(window => Math.abs(window.widthHours) < 1e-9));
  assert.ok(exposure.unionExposureHours < 1e-9);
  assert.ok(exposure.yearPercent < 1e-9);
  assert.equal(exposure.closed, true);
});

test("all 12 jie map to the canonical BaZi month-branch transition", () => {
  const exposure = monthBoundaryDisagreementExposure(2026, 26026);
  assert.deepEqual(
    exposure.windows.map(window => [window.name, window.beforeBranch, window.afterBranch]),
    EXPECTED_TRANSITIONS
  );
  assert.deepEqual(
    exposure.windows.map(window => window.monthTransition),
    EXPECTED_TRANSITIONS.map(([, before, after]) => `${before}→${after}`)
  );
});

test("only Li Chun is classified as a simultaneous year and month boundary", () => {
  const exposure = monthBoundaryDisagreementExposure(2026, 26026);
  const yearMonth = exposure.windows.filter(window => window.pillarImpact === "year+month");
  const monthOnly = exposure.windows.filter(window => window.pillarImpact === "month-only");

  assert.equal(yearMonth.length, 1);
  assert.equal(yearMonth[0].name, "立春");
  assert.equal(yearMonth[0].monthTransition, "丑→寅");
  assert.deepEqual(yearMonth[0].affectedPillars, ["year", "month"]);
  assert.equal(monthOnly.length, 11);
  assert.ok(monthOnly.every(window => window.affectedPillars.length === 1 && window.affectedPillars[0] === "month"));
});

test("24000-year exact discrete closure still sweeps substantial month-boundary time", () => {
  const exposure = monthBoundaryDisagreementExposure(2026, 26026);
  assert.equal(exposure.windows.length, 12);
  assert.equal(exposure.mergedWindows.length, 12);
  assert.ok(exposure.unionExposureHours > 500);
  assert.ok(exposure.yearPercent > 5 && exposure.yearPercent < 10);
  assert.ok(exposure.largestWindow.widthHours > 95 && exposure.largestWindow.widthHours < 96);
  assert.ok(exposure.yearMonthExposureHours > 0);
  assert.ok(exposure.monthOnlyExposureHours > exposure.yearMonthExposureHours);
  assert.ok(Math.abs(
    exposure.monthOnlyExposureHours + exposure.yearMonthExposureHours - exposure.unionExposureHours
  ) < 1e-9);
  assert.equal(exposure.yearMonthWindow.name, "立春");
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
  assert.ok(near.yearMonthExposureHours < first.yearMonthExposureHours);
  assert.ok(near.monthOnlyExposureHours < first.monthOnlyExposureHours);
});

test("window direction identifies which month branch each comparison occupies inside the swept interval", () => {
  const exposure = monthBoundaryDisagreementExposure(2026, 4006);
  assert.ok(exposure.windows.some(window => window.direction === "target-earlier"));
  assert.ok(exposure.windows.some(window => window.direction === "target-later"));

  for (const window of exposure.windows) {
    assert.ok(window.endDay >= window.startDay);
    assert.ok(Math.abs(window.widthHours - Math.abs(window.residualHours)) < 1e-9);

    if (window.direction === "target-later") {
      assert.equal(window.baseWindowBranch, window.afterBranch);
      assert.equal(window.targetWindowBranch, window.beforeBranch);
    } else if (window.direction === "target-earlier") {
      assert.equal(window.baseWindowBranch, window.beforeBranch);
      assert.equal(window.targetWindowBranch, window.afterBranch);
    } else {
      assert.equal(window.baseWindowBranch, null);
      assert.equal(window.targetWindowBranch, null);
    }
  }
});

test("Li Chun direction also identifies previous-vs-new year-pillar side", () => {
  const exposure = monthBoundaryDisagreementExposure(2026, 4006);
  const liChun = exposure.windows.find(window => window.name === "立春");
  assert.ok(liChun);
  assert.equal(liChun.isYearBoundary, true);

  if (liChun.direction === "target-later") {
    assert.equal(liChun.baseYearSide, "new");
    assert.equal(liChun.targetYearSide, "previous");
  } else if (liChun.direction === "target-earlier") {
    assert.equal(liChun.baseYearSide, "previous");
    assert.equal(liChun.targetYearSide, "new");
  } else {
    assert.equal(liChun.baseYearSide, null);
    assert.equal(liChun.targetYearSide, null);
  }
});
