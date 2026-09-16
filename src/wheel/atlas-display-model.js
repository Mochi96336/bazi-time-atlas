import { baziMonths, solarTerms, zodiacSigns } from "../data.js";
import { apparentSolarLongitude } from "../astronomy/solar-longitude.js";
import { resolveBirthPillars } from "../calendar/tyme-adapter.js";
import { monthPillarForYearStem } from "../calendar/five-tigers.js";
import { heavenlyStems, sexagenaryCycle } from "../sexagenary-data.js";
import { discretePhaseWindows } from "./discrete-phase.js";
import {
  DEFAULT_ATLAS_TIME_CONTEXT,
  normalizeAtlasTimeContext
} from "./atlas-time-context.js";
import { normalizeDegrees } from "./polar-geometry.js";

// Compatibility export for callers/tests that still name the current default.
// UTC+08 is now a default context value, not a display-model invariant.
export const ATLAS_UTC_OFFSET_HOURS = DEFAULT_ATLAS_TIME_CONTEXT.utcOffsetHours;
export const ATLAS_SEXAGENARY_NAMES = Object.freeze(sexagenaryCycle.map(item => item.name));

const VALID_STEM_NAMES = new Set(heavenlyStems.map(item => item.name));

function ganzhiIndex(name) {
  return ATLAS_SEXAGENARY_NAMES.indexOf(name);
}

function shortestCycleDelta(nextIndex, previousIndex, size = ATLAS_SEXAGENARY_NAMES.length) {
  let delta = (nextIndex - previousIndex) % size;
  if (delta > size / 2) delta -= size;
  if (delta < -size / 2) delta += size;
  return delta;
}

function rangeContains(start, end, angle) {
  const normalized = normalizeDegrees(angle);
  if (end > start) return normalized >= start && normalized < end;
  return normalized >= start || normalized < end;
}

function baziMonthAt(longitude) {
  return baziMonths.find(month => rangeContains(month.start, month.end, longitude));
}

function zodiacAt(longitude) {
  return zodiacSigns.find(sign => rangeContains(sign.start, sign.end, longitude));
}

function termAt(longitude) {
  return solarTerms[Math.floor(normalizeDegrees(longitude) / 15) % solarTerms.length];
}

function midpoint(start, end) {
  return normalizeDegrees(start + normalizeDegrees(end - start) / 2);
}

function nearestCycleIndexForBranch(branch, preferredIndex) {
  const candidates = ATLAS_SEXAGENARY_NAMES
    .map((name, index) => ({ name, index }))
    .filter(item => item.name.endsWith(branch));
  return candidates.reduce((best, candidate) => {
    const distance = Math.abs(shortestCycleDelta(candidate.index, preferredIndex));
    return !best || distance < best.distance ? { index: candidate.index, distance } : best;
  }, null)?.index ?? preferredIndex;
}

export function civilFieldsFromInstant(ms, timeContext = DEFAULT_ATLAS_TIME_CONTEXT) {
  const context = normalizeAtlasTimeContext(timeContext);
  const shifted = new Date(ms + context.utcOffsetHours * 3_600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds()
  };
}

export function solarLongitudeAtInstant(ms, timeContext = DEFAULT_ATLAS_TIME_CONTEXT) {
  const context = normalizeAtlasTimeContext(timeContext);
  return apparentSolarLongitude(
    civilFieldsFromInstant(ms, context),
    context.utcOffsetHours
  );
}

export function instantFromAtlasLocalInput(value, timeContext = DEFAULT_ATLAS_TIME_CONTEXT) {
  const match = /^(\d{4,6})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const context = normalizeAtlasTimeContext(timeContext);
  const [, y, m, d, h, min, sec = "0"] = match;
  return Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(sec))
    - context.utcOffsetHours * 3_600_000;
}

export function atlasInputValueFromFields(fields) {
  const pad = value => String(value).padStart(2, "0");
  return `${String(fields.year).padStart(4, "0")}-${pad(fields.month)}-${pad(fields.day)}T${pad(fields.hour)}:${pad(fields.minute)}:${pad(fields.second)}`;
}

export function formatAtlasCivil(fields) {
  const pad = value => String(value).padStart(2, "0");
  return `${fields.year}-${pad(fields.month)}-${pad(fields.day)} · ${pad(fields.hour)}:${pad(fields.minute)}:${pad(fields.second)}`;
}

export function parseAtlasSearch(search) {
  const params = new URLSearchParams(search);
  if (params.has("instant")) {
    const instantMs = Date.parse(params.get("instant"));
    if (Number.isFinite(instantMs)) {
      return Object.freeze({ instantMs, legacyProjection: null });
    }
  }

  const rawLongitude = params.has("lambda") ? Number(params.get("lambda")) : Number.NaN;
  const requestedMonth = params.get("month");
  const yearStem = params.get("yearStem");
  let longitude = Number.isFinite(rawLongitude) ? normalizeDegrees(rawLongitude) : null;
  let monthBranch = baziMonths.some(month => month.branch === requestedMonth) ? requestedMonth : null;

  if (longitude === null && monthBranch) {
    const month = baziMonths.find(item => item.branch === monthBranch);
    longitude = midpoint(month.start, month.end);
  }
  if (longitude !== null && !monthBranch) monthBranch = baziMonthAt(longitude)?.branch ?? null;
  if (longitude === null && !monthBranch) {
    return Object.freeze({ instantMs: null, legacyProjection: null });
  }

  const monthPillar = yearStem && VALID_STEM_NAMES.has(yearStem) && monthBranch
    ? monthPillarForYearStem(yearStem, monthBranch)
    : null;
  const legacyProjection = Object.freeze({ longitude, monthBranch, yearStem, monthPillar });
  return Object.freeze({ instantMs: null, legacyProjection });
}

export function resolveAtlasDisplayState({
  selectedMs,
  legacyProjection = null,
  timeContext = DEFAULT_ATLAS_TIME_CONTEXT
}) {
  const context = normalizeAtlasTimeContext(timeContext);
  const fields = civilFieldsFromInstant(selectedMs, context);
  const result = resolveBirthPillars(fields, {
    utcOffsetHours: context.utcOffsetHours,
    dayBoundary: context.dayBoundary
  });
  const actualLongitude = apparentSolarLongitude(fields, context.utcOffsetHours);
  const longitude = legacyProjection?.longitude ?? actualLongitude;
  const phases = { ...discretePhaseWindows(selectedMs, context) };
  const yearName = result.pillars.year.name;
  let monthName = result.pillars.month.name;
  let monthBranch = result.pillars.month.branch;

  if (legacyProjection?.monthBranch) {
    monthBranch = legacyProjection.monthBranch;
    phases.month = null;
  }
  if (legacyProjection?.monthPillar) monthName = legacyProjection.monthPillar;

  let monthIndex = ganzhiIndex(monthName);
  if (monthIndex < 0 || !monthName.endsWith(monthBranch)) {
    monthIndex = nearestCycleIndexForBranch(monthBranch, ganzhiIndex(result.pillars.month.name));
    monthName = ATLAS_SEXAGENARY_NAMES[monthIndex];
  }

  return {
    fields,
    timeContext: context,
    longitude,
    actualLongitude,
    phases,
    pillars: result.pillars,
    yearName,
    monthName,
    monthBranch,
    monthIndex,
    hourIndex: ganzhiIndex(result.pillars.hour.name),
    yearIndex: ganzhiIndex(yearName),
    dayIndex: ganzhiIndex(result.pillars.day.name),
    activeTerm: termAt(longitude),
    activeZodiac: zodiacAt(longitude)
  };
}
