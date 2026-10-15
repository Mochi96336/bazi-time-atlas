import { baziMonths } from "../data.js";

function freeze(value) {
  return Object.freeze(value);
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function rangeContains(start, end, angle) {
  const normalized = normalizeDegrees(angle);
  if (end > start) return normalized >= start && normalized < end;
  return normalized >= start || normalized < end;
}

export const BAZI_JIE_BOUNDARIES = Object.freeze(
  baziMonths.map(month => freeze({
    branch:month.branch,
    longitudeDegrees:month.start,
    termName:month.startTerm,
    nextTermName:month.endTerm,
    yearBoundary:month.startTerm === "立春"
  }))
);

export function baziMonthContextAtLongitude(longitudeDegrees) {
  const longitude = normalizeDegrees(longitudeDegrees);
  const month = baziMonths.find(candidate => rangeContains(candidate.start,candidate.end,longitude));
  if (!month) throw new RangeError("longitude does not map to a BaZi month");
  const boundary = BAZI_JIE_BOUNDARIES.find(candidate =>
    candidate.longitudeDegrees === longitude
  ) ?? null;
  const distanceToNextBoundaryDegrees = normalizeDegrees(month.end - longitude);
  return freeze({
    longitudeDegrees:longitude,
    branch:month.branch,
    startTerm:month.startTerm,
    endTerm:month.endTerm,
    startLongitudeDegrees:month.start,
    endLongitudeDegrees:month.end,
    boundary,
    distanceToNextBoundaryDegrees
  });
}

export function baziJieDriftSummary(driftDays, indexForLongitude) {
  if (!Array.isArray(driftDays) || driftDays.length !== 360) {
    throw new RangeError("driftDays must contain 360 longitude samples");
  }
  if (typeof indexForLongitude !== "function") {
    throw new TypeError("indexForLongitude must be a function");
  }
  const rows = BAZI_JIE_BOUNDARIES.map(boundary => {
    const drift = driftDays[indexForLongitude(boundary.longitudeDegrees)];
    if (!Number.isFinite(drift)) throw new RangeError("boundary drift must be finite");
    return freeze({ ...boundary, driftDays:drift });
  });
  const advances = rows.map(row => -row.driftDays);
  return freeze({
    count:rows.length,
    displacedCount:rows.filter(row => Math.abs(row.driftDays) > 1e-9).length,
    minAdvanceDays:Math.min(...advances),
    maxAdvanceDays:Math.max(...advances),
    rows:Object.freeze(rows)
  });
}
