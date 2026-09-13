import { solarTermShapeResiduals } from "./berger-orbit.js";

const EPSILON_DAYS = 1e-12;

function freezeWindow(term) {
  const startDay = Math.min(term.baseOffsetDays, term.targetOffsetDays);
  const endDay = Math.max(term.baseOffsetDays, term.targetOffsetDays);
  const widthHours = (endDay - startDay) * 24;
  return Object.freeze({
    name: term.name,
    longitude: term.longitude,
    baseOffsetDays: term.baseOffsetDays,
    targetOffsetDays: term.targetOffsetDays,
    residualHours: term.residualHours,
    direction: term.residualHours > 0 ? "target-later" : term.residualHours < 0 ? "target-earlier" : "aligned",
    startDay,
    endDay,
    widthHours
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

export function monthBoundaryDisagreementExposure(baseYear, targetYear) {
  const residuals = solarTermShapeResiduals(baseYear, targetYear);
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

  return Object.freeze({
    model: residuals.model,
    baseYear,
    targetYear,
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
    closed: unionExposureHours < 1e-9
  });
}