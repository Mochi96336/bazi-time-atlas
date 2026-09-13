import { FIVE_TIGERS_MONTH_BRANCHES } from "../calendar/five-tigers.js";
import { solarTermShapeResiduals } from "./berger-orbit.js";

const EPSILON_DAYS = 1e-12;
const LI_CHUN_LONGITUDE = 315;

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function monthTransitionAtLongitude(longitude) {
  const offset = mod(longitude - LI_CHUN_LONGITUDE, 360);
  const rawIndex = offset / 30;
  const index = Math.round(rawIndex);
  if (Math.abs(rawIndex - index) > 1e-9 || index < 0 || index >= FIVE_TIGERS_MONTH_BRANCHES.length) {
    throw new RangeError(`jie longitude ${longitude}° does not map to a BaZi 30° month boundary`);
  }
  const afterBranch = FIVE_TIGERS_MONTH_BRANCHES[index];
  const beforeBranch = FIVE_TIGERS_MONTH_BRANCHES[mod(index - 1, FIVE_TIGERS_MONTH_BRANCHES.length)];
  return Object.freeze({ beforeBranch, afterBranch });
}

function freezeWindow(term) {
  const startDay = Math.min(term.baseOffsetDays, term.targetOffsetDays);
  const endDay = Math.max(term.baseOffsetDays, term.targetOffsetDays);
  const widthHours = (endDay - startDay) * 24;
  const direction = term.residualHours > 0
    ? "target-later"
    : term.residualHours < 0
      ? "target-earlier"
      : "aligned";
  const { beforeBranch, afterBranch } = monthTransitionAtLongitude(term.longitude);
  const isYearBoundary = term.name === "立春";

  let baseWindowBranch = null;
  let targetWindowBranch = null;
  let baseYearSide = null;
  let targetYearSide = null;
  if (direction === "target-later") {
    baseWindowBranch = afterBranch;
    targetWindowBranch = beforeBranch;
    if (isYearBoundary) {
      baseYearSide = "new";
      targetYearSide = "previous";
    }
  } else if (direction === "target-earlier") {
    baseWindowBranch = beforeBranch;
    targetWindowBranch = afterBranch;
    if (isYearBoundary) {
      baseYearSide = "previous";
      targetYearSide = "new";
    }
  }

  return Object.freeze({
    name: term.name,
    longitude: term.longitude,
    baseOffsetDays: term.baseOffsetDays,
    targetOffsetDays: term.targetOffsetDays,
    residualHours: term.residualHours,
    direction,
    startDay,
    endDay,
    widthHours,
    beforeBranch,
    afterBranch,
    monthTransition: `${beforeBranch}→${afterBranch}`,
    baseWindowBranch,
    targetWindowBranch,
    isYearBoundary,
    pillarImpact: isYearBoundary ? "year+month" : "month-only",
    affectedPillars: Object.freeze(isYearBoundary ? ["year", "month"] : ["month"]),
    baseYearSide,
    targetYearSide
  });
}

function mergeLinearWindows(windows) {
  const sorted = windows
    .filter(window => window.widthHours > EPSILON_DAYS * 24)
    .map(window => ({ startDay:window.startDay, endDay:window.endDay }))
    .sort((a, b) => a.startDay - b.startDay || a.endDay - b.endDay);

  const merged = [];
  for (const window of sorted) {
    const previous = merged.at(-1);
    if (!previous || window.startDay > previous.endDay + EPSILON_DAYS) {
      merged.push({ ...window });
      continue;
    }
    previous.endDay = Math.max(previous.endDay, window.endDay);
  }
  return Object.freeze(merged.map(window => Object.freeze(window)));
}

export function monthBoundaryDisagreementExposureFromResiduals(residuals) {
  if (!residuals || !Array.isArray(residuals.terms) || !Number.isFinite(residuals.normalizationDays)) {
    throw new TypeError("valid solar-term residual result required");
  }

  const windows = Object.freeze(residuals.terms.map(freezeWindow));
  const mergedWindows = mergeLinearWindows(windows);
  const rawSweepHours = windows.reduce((sum, window) => sum + window.widthHours, 0);
  const unionExposureHours = mergedWindows.reduce(
    (sum, window) => sum + (window.endDay - window.startDay) * 24,
    0
  );
  const overlapHours = Math.max(0, rawSweepHours - unionExposureHours);
  const normalizedYearHours = residuals.normalizationDays * 24;
  const yearFraction = unionExposureHours / normalizedYearHours;
  const largestWindow = windows.reduce(
    (best, window) => !best || window.widthHours > best.widthHours ? window : best,
    null
  );
  const yearMonthWindow = windows.find(window => window.isYearBoundary) ?? null;
  const yearMonthExposureHours = yearMonthWindow?.widthHours ?? 0;
  const monthOnlyExposureHours = Math.max(0, unionExposureHours - yearMonthExposureHours);

  return Object.freeze({
    model: residuals.model,
    baseYear: residuals.baseYear,
    targetYear: residuals.targetYear,
    anchor: residuals.anchor,
    normalizationDays: residuals.normalizationDays,
    normalizedYearHours,
    windows,
    mergedWindows,
    rawSweepHours,
    unionExposureHours,
    overlapHours,
    yearFraction,
    yearPercent: yearFraction * 100,
    largestWindow,
    yearMonthWindow,
    yearMonthExposureHours,
    yearMonthPercent: yearMonthExposureHours / normalizedYearHours * 100,
    monthOnlyExposureHours,
    monthOnlyPercent: monthOnlyExposureHours / normalizedYearHours * 100,
    closed: unionExposureHours < 1e-9
  });
}

export function monthBoundaryDisagreementExposure(baseYear, targetYear) {
  return monthBoundaryDisagreementExposureFromResiduals(
    solarTermShapeResiduals(baseYear, targetYear)
  );
}
