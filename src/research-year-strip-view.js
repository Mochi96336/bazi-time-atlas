import {
  gregorianOrdinal,
  recurrenceState,
  validateGregorianDate
} from "./recurrence/gregorian-cycle.js";
import { solarTermEventForCivilYear } from "./astronomy/solar-term-boundaries.js";
import { sexagenaryYearPillarForLiChunYear } from "./calendar/sexagenary-year.js";

const strip = typeof document === "undefined" ? null : document.querySelector("#research-year-strip");
const instrument = typeof document === "undefined" ? null : document.querySelector("#recurrence-instrument");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseDate(value) {
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

export function researchYearStripState(selectedDate) {
  if (!validateGregorianDate(selectedDate)) throw new RangeError("invalid selectedDate");

  const next = recurrenceState(selectedDate, 1);
  const liChun = exactLiChunForYear(selectedDate.year);
  const selectedPosition = positionForDate(selectedDate);
  const nextDate = next.targetValid ? next.targetDate : null;
  const selectedOrdinal = gregorianOrdinal(selectedDate);
  const liChunOrdinal = liChun ? gregorianOrdinal(liChun.date) : null;
  const selectedLiChunRelation = liChunOrdinal === null
    ? "unknown"
    : selectedOrdinal < liChunOrdinal
      ? "before"
      : selectedOrdinal > liChunOrdinal
        ? "after"
        : "boundary-day";
  const selectedBeforeLiChun = selectedLiChunRelation === "before"
    ? true
    : selectedLiChunRelation === "after"
      ? false
      : null;
  const beforeYearPillar = sexagenaryYearPillarForLiChunYear(selectedDate.year - 1);
  const afterYearPillar = sexagenaryYearPillarForLiChunYear(selectedDate.year);
  const liChunTransition = liChun
    ? Object.freeze({ before:beforeYearPillar, after:afterYearPillar })
    : null;
  const selectedYearPillar = selectedBeforeLiChun === null
    ? null
    : selectedBeforeLiChun ? beforeYearPillar : afterYearPillar;

  return Object.freeze({
    selectedDate:Object.freeze({ ...selectedDate }),
    selectedPosition,
    liChun,
    selectedLiChunRelation,
    selectedBeforeLiChun,
    liChunTransition,
    selectedYearPillar,
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
  const selectedDate = parseDate(instrument.dataset.targetDate);
  if (!selectedDate) {
    strip.dataset.ready = "false";
    return;
  }

  const state = researchYearStripState(selectedDate);
  const baseMarker = document.querySelector("#research-year-base-marker");
  const liChunMarker = document.querySelector("#research-year-li-chun-marker");
  const liChunUnavailable = document.querySelector("#research-year-li-chun-unavailable");

  strip.dataset.ready = "true";
  strip.dataset.liChunPositionAvailable = String(Boolean(state.liChun));
  strip.dataset.selectedLiChunRelation = state.selectedLiChunRelation;
  strip.dataset.selectedBeforeLiChun = state.selectedBeforeLiChun === null ? "unknown" : String(state.selectedBeforeLiChun);
  strip.dataset.baseEdge = state.selectedPosition < 20 ? "start" : state.selectedPosition > 80 ? "end" : "none";
  strip.dataset.elapsedDays = state.elapsedDays === null ? "unavailable" : String(state.elapsedDays);
  strip.dataset.selectedYearPillar = state.selectedYearPillar?.name ?? "unavailable";
  strip.dataset.liChunYearPillarBefore = state.liChunTransition?.before.name ?? "unavailable";
  strip.dataset.liChunYearPillarAfter = state.liChunTransition?.after.name ?? "unavailable";

  if (baseMarker) baseMarker.style.setProperty("--year-x", `${state.selectedPosition.toFixed(4)}%`);
  setText(
    "research-year-base-title",
    state.selectedYearPillar
      ? `選定日 · ${state.selectedYearPillar.name}年`
      : state.selectedLiChunRelation === "boundary-day"
        ? "選定日 · 立春日需時刻判定"
        : "選定日 · 年柱待節氣判定"
  );
  setText("research-year-base-label", formatDate(state.selectedDate));
  setText("research-year-base-date", formatDate(state.selectedDate));

  if (state.liChun) {
    liChunMarker.hidden = false;
    liChunMarker.style.setProperty("--year-x", `${state.liChun.position.toFixed(4)}%`);
    setText(
      "research-year-li-chun-title",
      `立春 · ${state.liChunTransition.before.name} → ${state.liChunTransition.after.name}`
    );
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
    if (records.some(record => record.attributeName === "data-target-date")) render();
  });
  observer.observe(instrument, { attributes:true, attributeFilter:["data-target-date"] });
  render();
}
