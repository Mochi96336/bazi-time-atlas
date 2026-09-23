import {
  gregorianOrdinal,
  recurrenceState,
  validateGregorianDate
} from "./recurrence/gregorian-cycle.js";
import { solarTermEventForCivilYear } from "./astronomy/solar-term-boundaries.js";

const strip = typeof document === "undefined" ? null : document.querySelector("#research-year-strip");
const instrument = typeof document === "undefined" ? null : document.querySelector("#recurrence-instrument");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseBaseDate(value) {
  const match = /^(\d{1,8})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const date = { year:Number(match[1]), month:Number(match[2]), day:Number(match[3]) };
  return validateGregorianDate(date) ? date : null;
}

function formatDate(date) {
  const pad = value => String(value).padStart(2, "0");
  return `${date.year}/${pad(date.month)}/${pad(date.day)}`;
}

function positionForDate(date, fraction = 0) {
  const start = gregorianOrdinal({ year:date.year, month:1, day:1 });
  const end = gregorianOrdinal({ year:date.year, month:12, day:31 });
  const current = gregorianOrdinal(date);
  const denominator = Math.max(1, end - start);
  return clamp(((current - start + fraction) / denominator) * 100, 0, 100);
}

function exactLiChunForYear(year) {
  try {
    const event = solarTermEventForCivilYear(year, "立春");
    const fields = event.referenceFields;
    const date = { year:fields.year, month:fields.month, day:fields.day };
    if (!validateGregorianDate(date)) return null;
    const fraction = (fields.hour * 3600 + fields.minute * 60 + fields.second) / 86400;
    return Object.freeze({
      event,
      date:Object.freeze(date),
      position:positionForDate(date, fraction),
      label:`${fields.month}/${fields.day} ${String(fields.hour).padStart(2,"0")}:${String(fields.minute).padStart(2,"0")}`
    });
  } catch {
    return null;
  }
}

export function researchYearStripState(baseDate) {
  if (!validateGregorianDate(baseDate)) throw new RangeError("invalid baseDate");

  const next = recurrenceState(baseDate, 1);
  const liChun = exactLiChunForYear(baseDate.year);
  const basePosition = positionForDate(baseDate);
  const nextDate = next.targetValid ? next.targetDate : null;

  return Object.freeze({
    baseDate:Object.freeze({ ...baseDate }),
    basePosition,
    liChun,
    baseBeforeLiChun:liChun ? basePosition < liChun.position : null,
    nextDate:nextDate ? Object.freeze({ ...nextDate }) : null,
    elapsedDays:next.dayDelta
  });
}

function setText(id, value) {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = value;
}

function render() {
  if (!strip || !instrument) return;
  const baseDate = parseBaseDate(instrument.dataset.baseDate);
  if (!baseDate) {
    strip.dataset.ready = "false";
    return;
  }

  const state = researchYearStripState(baseDate);
  const baseMarker = document.querySelector("#research-year-base-marker");
  const liChunMarker = document.querySelector("#research-year-li-chun-marker");
  const liChunUnavailable = document.querySelector("#research-year-li-chun-unavailable");

  strip.dataset.ready = "true";
  strip.dataset.liChunPositionAvailable = String(Boolean(state.liChun));
  strip.dataset.baseBeforeLiChun = state.baseBeforeLiChun === null ? "unknown" : String(state.baseBeforeLiChun);
  strip.dataset.baseEdge = state.basePosition < 20 ? "start" : state.basePosition > 80 ? "end" : "none";
  strip.dataset.elapsedDays = state.elapsedDays === null ? "unavailable" : String(state.elapsedDays);

  if (baseMarker) baseMarker.style.setProperty("--year-x", `${state.basePosition.toFixed(4)}%`);
  setText("research-year-base-label", formatDate(state.baseDate));
  setText("research-year-base-date", formatDate(state.baseDate));

  if (state.liChun) {
    liChunMarker.hidden = false;
    liChunMarker.style.setProperty("--year-x", `${state.liChun.position.toFixed(4)}%`);
    setText("research-year-li-chun-label", state.liChun.label);
    liChunUnavailable.hidden = true;
  } else {
    liChunMarker.hidden = true;
    liChunUnavailable.hidden = false;
  }

  const elapsed = state.elapsedDays === null ? "—" : String(state.elapsedDays);
  setText("research-year-day-count", elapsed);
  setText("research-year-elapsed-days", elapsed);
  setText("research-year-next-date", state.nextDate ? formatDate(state.nextDate) : "下一年同月同日不存在");
}

if (strip && instrument) {
  const observer = new MutationObserver(records => {
    if (records.some(record => record.attributeName === "data-base-date")) render();
  });
  observer.observe(instrument, { attributes:true, attributeFilter:["data-base-date"] });
  render();
}
