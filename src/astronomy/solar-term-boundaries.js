import { SolarTerm } from "../../vendor/tyme4ts-1.5.2.mjs";
import { solarTerms } from "../data.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
export const SOLAR_TERM_REFERENCE_UTC_OFFSET = 8;

const TYME_NAMES = Object.freeze({
  春分: "春分",
  清明: "清明",
  穀雨: "谷雨",
  立夏: "立夏",
  小滿: "小满",
  芒種: "芒种",
  夏至: "夏至",
  小暑: "小暑",
  大暑: "大暑",
  立秋: "立秋",
  處暑: "处暑",
  白露: "白露",
  秋分: "秋分",
  寒露: "寒露",
  霜降: "霜降",
  立冬: "立冬",
  小雪: "小雪",
  大雪: "大雪",
  冬至: "冬至",
  小寒: "小寒",
  大寒: "大寒",
  立春: "立春",
  雨水: "雨水",
  驚蟄: "惊蛰"
});

const eventCache = new Map();
const yearCache = new Map();
let lastDefaultJieInterval = null;

function validateYear(year) {
  if (!Number.isInteger(year) || year < -9999 || year > 9999) {
    throw new RangeError("year must be an integer from -9999 to 9999");
  }
}

function utcMillisFromReferenceFields(fields) {
  const date = new Date(0);
  date.setUTCFullYear(fields.year, fields.month - 1, fields.day);
  date.setUTCHours(fields.hour, fields.minute, fields.second, 0);
  return date.getTime() - SOLAR_TERM_REFERENCE_UTC_OFFSET * HOUR_MS;
}

function fieldsFromSolarTime(time) {
  return {
    year: time.getYear(),
    month: time.getMonth(),
    day: time.getDay(),
    hour: time.getHour(),
    minute: time.getMinute(),
    second: time.getSecond()
  };
}

function termDefinition(name) {
  const term = solarTerms.find(item => item.name === name);
  if (!term) throw new RangeError(`unknown solar term: ${name}`);
  return term;
}

function eventForTerm(year, term) {
  const tymeName = TYME_NAMES[term.name];
  if (!tymeName) throw new RangeError(`no Tyme solar-term name mapping for ${term.name}`);
  const solarTerm = SolarTerm.fromName(year, tymeName);
  const referenceTime = solarTerm.getJulianDay().getSolarTime();
  const referenceFields = fieldsFromSolarTime(referenceTime);

  return Object.freeze({
    name: term.name,
    kind: term.kind,
    longitude: term.longitude,
    instantMs: utcMillisFromReferenceFields(referenceFields),
    referenceFields: Object.freeze(referenceFields),
    referenceUtcOffsetHours: SOLAR_TERM_REFERENCE_UTC_OFFSET
  });
}

export function solarTermEventForCivilYear(year, name) {
  validateYear(year);
  const key = `${year}|${name}`;
  if (!eventCache.has(key)) eventCache.set(key, eventForTerm(year, termDefinition(name)));
  return eventCache.get(key);
}

export function solarTermEventsForCivilYear(year) {
  validateYear(year);
  if (!yearCache.has(year)) {
    const events = solarTerms
      .map(term => solarTermEventForCivilYear(year, term.name))
      .sort((a, b) => a.instantMs - b.instantMs);
    yearCache.set(year, Object.freeze(events));
  }
  return yearCache.get(year);
}

function referenceCivilYearAtInstant(instantMs) {
  const shifted = new Date(instantMs + SOLAR_TERM_REFERENCE_UTC_OFFSET * HOUR_MS);
  return shifted.getUTCFullYear();
}

function yearRangeForInstants(startMs, endMs) {
  const lo = Math.min(startMs, endMs);
  const hi = Math.max(startMs, endMs);
  return {
    lo,
    hi,
    firstYear: referenceCivilYearAtInstant(lo) - 1,
    lastYear: referenceCivilYearAtInstant(hi) + 1
  };
}

export function solarTermEventsBetween(startMs, endMs) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new RangeError("startMs and endMs must be finite");
  }
  const { lo, hi, firstYear, lastYear } = yearRangeForInstants(startMs, endMs);
  const events = [];

  for (let year = firstYear; year <= lastYear; year += 1) {
    for (const event of solarTermEventsForCivilYear(year)) {
      if (event.instantMs >= lo && event.instantMs <= hi) events.push(event);
    }
  }

  events.sort((a, b) => a.instantMs - b.instantMs);
  return events;
}

export function solarTermNamedEventsBetween(startMs, endMs, names) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new RangeError("startMs and endMs must be finite");
  }
  if (!Array.isArray(names) || names.length === 0) {
    throw new RangeError("names must be a non-empty array");
  }
  const uniqueNames = [...new Set(names)];
  uniqueNames.forEach(termDefinition);
  const { lo, hi, firstYear, lastYear } = yearRangeForInstants(startMs, endMs);
  const events = [];

  for (let year = firstYear; year <= lastYear; year += 1) {
    for (const name of uniqueNames) {
      const event = solarTermEventForCivilYear(year, name);
      if (event.instantMs >= lo && event.instantMs <= hi) events.push(event);
    }
  }

  events.sort((a, b) => a.instantMs - b.instantMs);
  return events;
}

export function jieBoundaryContext(instantMs, options = {}) {
  if (!Number.isFinite(instantMs)) throw new RangeError("instantMs must be finite");
  const customSpan = options.searchSpanDays !== undefined;
  const span = options.searchSpanDays ?? 370;
  if (!Number.isFinite(span) || span <= 0) throw new RangeError("searchSpanDays must be positive");

  if (
    !customSpan &&
    lastDefaultJieInterval?.previous &&
    lastDefaultJieInterval?.next &&
    instantMs >= lastDefaultJieInterval.previous.instantMs &&
    instantMs < lastDefaultJieInterval.next.instantMs
  ) {
    return {
      previous: lastDefaultJieInterval.previous,
      next: lastDefaultJieInterval.next
    };
  }

  const events = solarTermEventsBetween(
    instantMs - span * DAY_MS,
    instantMs + span * DAY_MS
  ).filter(event => event.kind === "jie");

  let previous = null;
  let next = null;
  for (const event of events) {
    if (event.instantMs <= instantMs) previous = event;
    if (event.instantMs > instantMs) {
      next = event;
      break;
    }
  }

  if (!customSpan && previous && next) {
    lastDefaultJieInterval = { previous, next };
  }
  return { previous, next };
}

export function formatSolarTermEvent(event) {
  if (!event) return "—";
  const fields = event.referenceFields;
  const pad = value => String(value).padStart(2, "0");
  return `${event.name} ${fields.year}-${pad(fields.month)}-${pad(fields.day)} ${pad(fields.hour)}:${pad(fields.minute)}:${pad(fields.second)}`;
}
