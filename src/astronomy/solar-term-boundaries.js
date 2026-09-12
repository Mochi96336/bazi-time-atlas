import { SolarTerm } from "../../vendor/tyme4ts-1.5.2.mjs";
import { solarTerms } from "../data.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

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

const yearCache = new Map();

function assertUtcOffset(utcOffsetHours) {
  if (!Number.isFinite(utcOffsetHours) || utcOffsetHours < -14 || utcOffsetHours > 14) {
    throw new RangeError("utcOffsetHours must be a finite number from -14 to +14");
  }
}

function utcMillisFromCivilFields(fields, utcOffsetHours) {
  const date = new Date(0);
  date.setUTCFullYear(fields.year, fields.month - 1, fields.day);
  date.setUTCHours(fields.hour, fields.minute, fields.second, 0);
  return date.getTime() - utcOffsetHours * HOUR_MS;
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

function eventForTerm(year, term, utcOffsetHours) {
  const tymeName = TYME_NAMES[term.name];
  if (!tymeName) throw new RangeError(`no Tyme solar-term name mapping for ${term.name}`);
  const solarTerm = SolarTerm.fromName(year, tymeName);
  const referenceTime = solarTerm.getJulianDay().getSolarTime();
  const referenceFields = fieldsFromSolarTime(referenceTime);
  const instantMs = utcMillisFromCivilFields(referenceFields, utcOffsetHours);

  return Object.freeze({
    name: term.name,
    kind: term.kind,
    longitude: term.longitude,
    instantMs,
    referenceFields: Object.freeze(referenceFields),
    referenceUtcOffsetHours: utcOffsetHours
  });
}

export function solarTermEventsForCivilYear(year, utcOffsetHours = 8) {
  if (!Number.isInteger(year) || year < -9999 || year > 9999) {
    throw new RangeError("year must be an integer from -9999 to 9999");
  }
  assertUtcOffset(utcOffsetHours);
  const key = `${year}|${utcOffsetHours}`;
  if (!yearCache.has(key)) {
    const events = solarTerms
      .map(term => eventForTerm(year, term, utcOffsetHours))
      .sort((a, b) => a.instantMs - b.instantMs);
    yearCache.set(key, Object.freeze(events));
  }
  return yearCache.get(key);
}

function localCivilYearAtInstant(instantMs, utcOffsetHours) {
  const shifted = new Date(instantMs + utcOffsetHours * HOUR_MS);
  return shifted.getUTCFullYear();
}

export function solarTermEventsBetween(startMs, endMs, options = {}) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new RangeError("startMs and endMs must be finite");
  }
  const utcOffsetHours = options.utcOffsetHours ?? 8;
  assertUtcOffset(utcOffsetHours);
  const lo = Math.min(startMs, endMs);
  const hi = Math.max(startMs, endMs);
  const firstYear = localCivilYearAtInstant(lo, utcOffsetHours) - 1;
  const lastYear = localCivilYearAtInstant(hi, utcOffsetHours) + 1;
  const events = [];

  for (let year = firstYear; year <= lastYear; year += 1) {
    for (const event of solarTermEventsForCivilYear(year, utcOffsetHours)) {
      if (event.instantMs >= lo && event.instantMs <= hi) events.push(event);
    }
  }

  events.sort((a, b) => a.instantMs - b.instantMs);
  return events;
}

export function jieBoundaryContext(instantMs, options = {}) {
  if (!Number.isFinite(instantMs)) throw new RangeError("instantMs must be finite");
  const utcOffsetHours = options.utcOffsetHours ?? 8;
  assertUtcOffset(utcOffsetHours);
  const span = options.searchSpanDays ?? 370;
  if (!Number.isFinite(span) || span <= 0) throw new RangeError("searchSpanDays must be positive");
  const events = solarTermEventsBetween(
    instantMs - span * DAY_MS,
    instantMs + span * DAY_MS,
    { utcOffsetHours }
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
  return { previous, next };
}

export function formatSolarTermEvent(event) {
  if (!event) return "—";
  const fields = event.referenceFields;
  const pad = value => String(value).padStart(2, "0");
  return `${event.name} ${fields.year}-${pad(fields.month)}-${pad(fields.day)} ${pad(fields.hour)}:${pad(fields.minute)}:${pad(fields.second)}`;
}

export const SOLAR_TERM_REFERENCE_UTC_OFFSET = 8;
