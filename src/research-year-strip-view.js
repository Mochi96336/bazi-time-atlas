import {
  gregorianOrdinal,
  recurrenceState,
  validateGregorianDate
} from "./recurrence/gregorian-cycle.js";
import { sexagenaryYearPillarForLiChunYear } from "./calendar/sexagenary-year.js";
import { resolveSeasonalBoundary } from "./recurrence/seasonal-boundary-authority.js";
import { projectSeasonalBoundaryToCivil } from "./recurrence/seasonal-civil-projection.js";
import {
  TARGET_INSTANT_BASIS
} from "./recurrence/target-instant-binding.js";
import { readSelectedTargetInstant } from "./recurrence/target-instant-instrument.js";

const LI_CHUN_LONGITUDE_DEGREES = 315;
const DEFAULT_YEAR_STRIP_OFFSET_HOURS_FROM_UT1 = 8;

const strip = typeof document === "undefined" ? null : document.querySelector("#research-year-strip");
const instrument = typeof document === "undefined" ? null : document.querySelector("#recurrence-instrument");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function freeze(value) {
  return Object.freeze(value);
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

function offsetLabel(offsetHours) {
  return `UT1${offsetHours >= 0 ? "+" : ""}${offsetHours}`;
}

function seasonalAuthorityLabel(boundary) {
  if (boundary.authorityClass === "source-derived-research-evidence") {
    return "DE441-derived · source-derived";
  }
  if (boundary.authorityClass === "reviewed-production-direct-event") {
    return boundary.providerId?.includes("de441")
      ? "DE441 · reviewed direct event"
      : "reviewed direct event";
  }
  if (boundary.authorityClass === "declared-model-direct-event") {
    return "ShouXing · model";
  }
  return boundary.providerId ?? "seasonal authority";
}

function positionForDate(date, fraction = 0) {
  const start = gregorianOrdinal({ year:date.year, month:1, day:1 });
  const end = gregorianOrdinal({ year:date.year, month:12, day:31 });
  const current = gregorianOrdinal(date);
  const denominator = Math.max(1, end - start);
  return clamp(((current - start + fraction) / denominator) * 100, 0, 100);
}

function positionForLocalClock(clock) {
  const date = { year:clock.year, month:clock.month, day:clock.day };
  if (!validateGregorianDate(date)) return null;
  const fraction = (clock.hour * 3600 + clock.minute * 60 + clock.second) / 86400;
  return positionForDate(date, fraction);
}

function dateFromLocalClock(clock) {
  if (!clock) return null;
  const date = { year:clock.year, month:clock.month, day:clock.day };
  return validateGregorianDate(date) ? freeze(date) : null;
}

function formatClock(clock) {
  const pad = value => String(Math.floor(value)).padStart(2, "0");
  return `${clock.month}/${clock.day} ${pad(clock.hour)}:${pad(clock.minute)}`;
}

function yearStripOffset(targetInstant) {
  if (
    targetInstant?.basis === TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1
    && Number.isFinite(targetInstant.localOffsetHoursFromUt1)
  ) {
    return freeze({
      hours:targetInstant.localOffsetHoursFromUt1,
      source:"selected-target-instant"
    });
  }
  return freeze({
    hours:DEFAULT_YEAR_STRIP_OFFSET_HOURS_FROM_UT1,
    source:"research-display-default"
  });
}

function liChunDisplay(boundary, projection) {
  if (!projection?.pointEstimateAvailable || !projection.localClock) return null;
  const date = dateFromLocalClock(projection.localClock);
  const position = positionForLocalClock(projection.localClock);
  if (!date || position === null) return null;

  if (projection.status === "estimated") {
    const minPosition = positionForLocalClock(projection.oneSigmaLocalClockMin);
    const maxPosition = positionForLocalClock(projection.oneSigmaLocalClockMax);
    return freeze({
      date,
      position,
      positionStatus:"estimated",
      positionMin:minPosition,
      positionMax:maxPosition,
      label:`≈ ${formatClock(projection.localClock)} · ±${(projection.uncertaintySeconds / 3600).toFixed(1)} h`,
      providerId:boundary.providerId
    });
  }

  return freeze({
    date,
    position,
    positionStatus:"resolved",
    positionMin:position,
    positionMax:position,
    label:formatClock(projection.localClock),
    providerId:boundary.providerId
  });
}

function compareTargetInstantToBoundary({ targetInstant, boundary, projection }) {
  if (!targetInstant?.bound) return null;

  if (
    targetInstant.basis === TARGET_INSTANT_BASIS.TT_JULIAN_DAY
    && Number.isFinite(targetInstant.julianDay)
    && Number.isFinite(boundary.ttJulianDay)
  ) {
    return targetInstant.julianDay < boundary.ttJulianDay ? "before" : "after";
  }

  if (
    (targetInstant.basis === TARGET_INSTANT_BASIS.UT1_JULIAN_DAY
      || targetInstant.basis === TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1)
    && Number.isFinite(targetInstant.julianDay)
  ) {
    if (projection.status === "resolved" && Number.isFinite(projection.ut1JulianDay)) {
      return targetInstant.julianDay < projection.ut1JulianDay ? "before" : "after";
    }
    if (
      projection.status === "estimated"
      && Number.isFinite(projection.oneSigmaLocalJulianDayMin)
      && Number.isFinite(projection.oneSigmaLocalJulianDayMax)
    ) {
      const offsetDays = (projection.localOffsetHoursFromUt1 ?? 0) / 24;
      const targetLocalJulianDay = targetInstant.julianDay + offsetDays;
      if (targetLocalJulianDay < projection.oneSigmaLocalJulianDayMin) return "before";
      if (targetLocalJulianDay > projection.oneSigmaLocalJulianDayMax) return "after";
      return "boundary-uncertain";
    }
  }

  return null;
}

function civilDateRelation(selectedDate, projection) {
  const selectedOrdinal = gregorianOrdinal(selectedDate);

  if (projection.status === "resolved" && projection.localClock) {
    const boundaryDate = dateFromLocalClock(projection.localClock);
    if (!boundaryDate) return "unknown";
    const boundaryOrdinal = gregorianOrdinal(boundaryDate);
    if (selectedOrdinal < boundaryOrdinal) return "before";
    if (selectedOrdinal > boundaryOrdinal) return "after";
    return "boundary-day";
  }

  if (
    projection.status === "estimated"
    && projection.oneSigmaLocalClockMin
    && projection.oneSigmaLocalClockMax
  ) {
    const minDate = dateFromLocalClock(projection.oneSigmaLocalClockMin);
    const maxDate = dateFromLocalClock(projection.oneSigmaLocalClockMax);
    if (!minDate || !maxDate) return "unknown";
    const minOrdinal = gregorianOrdinal(minDate);
    const maxOrdinal = gregorianOrdinal(maxDate);
    if (selectedOrdinal < minOrdinal) return "before";
    if (selectedOrdinal > maxOrdinal) return "after";
    return "boundary-uncertain";
  }

  return "unknown";
}

function instantResolution({ civilRelation, targetInstant, boundary, projection }) {
  if (!["boundary-day", "boundary-uncertain"].includes(civilRelation)) return null;
  if (!targetInstant?.bound) {
    return freeze({
      status:civilRelation === "boundary-day"
        ? "target-instant-unbound"
        : "earth-rotation-uncertain",
      side:null,
      targetBasis:targetInstant?.basis ?? "date-only"
    });
  }

  const side = compareTargetInstantToBoundary({ targetInstant, boundary, projection });
  if (side === "before" || side === "after") {
    return freeze({
      status:"resolved",
      side,
      targetBasis:targetInstant.basis
    });
  }

  return freeze({
    status:projection.status === "estimated"
      ? "earth-rotation-uncertain"
      : "target-time-scale-unresolved",
    side:null,
    targetBasis:targetInstant.basis
  });
}

function unavailableMessage(boundary) {
  if (boundary.status === "source-covered-runtime-missing") {
    const source = boundary.sourceIds?.includes("jpl-de441") ? "DE441" : "absolute source";
    return `${source} 涵蓋此年 · 節氣 epoch 尚未發布`;
  }
  if (boundary.status === "absolute-source-unavailable") {
    return "超出目前 absolute seasonal-epoch source";
  }
  return "節氣天文 epoch 尚未解析";
}

export function researchYearStripState(selectedDate, { targetInstant = null } = {}) {
  if (!validateGregorianDate(selectedDate)) throw new RangeError("invalid selectedDate");

  const next = recurrenceState(selectedDate, 1);
  const displayOffset = yearStripOffset(targetInstant);
  const liChunBoundary = resolveSeasonalBoundary({
    year:selectedDate.year,
    longitudeDegrees:LI_CHUN_LONGITUDE_DEGREES
  });
  const liChunProjection = projectSeasonalBoundaryToCivil({
    year:selectedDate.year,
    boundary:liChunBoundary,
    localOffsetHoursFromUt1:displayOffset.hours
  });
  const liChun = liChunDisplay(liChunBoundary, liChunProjection);
  const selectedPosition = positionForDate(selectedDate);
  const nextDate = next.targetValid ? next.targetDate : null;

  const beforeYearPillar = sexagenaryYearPillarForLiChunYear(selectedDate.year - 1);
  const afterYearPillar = sexagenaryYearPillarForLiChunYear(selectedDate.year);
  const liChunTransition = freeze({ before:beforeYearPillar, after:afterYearPillar });

  const selectedCivilLiChunRelation = civilDateRelation(selectedDate, liChunProjection);
  const liChunInstantResolution = instantResolution({
    civilRelation:selectedCivilLiChunRelation,
    targetInstant,
    boundary:liChunBoundary,
    projection:liChunProjection
  });
  const selectedLiChunRelation = liChunInstantResolution?.status === "resolved"
    ? liChunInstantResolution.side
    : selectedCivilLiChunRelation;
  const selectedBeforeLiChun = selectedLiChunRelation === "before"
    ? true
    : selectedLiChunRelation === "after"
      ? false
      : null;
  const selectedYearPillar = selectedBeforeLiChun === null
    ? null
    : selectedBeforeLiChun ? beforeYearPillar : afterYearPillar;

  return freeze({
    selectedDate:freeze({ ...selectedDate }),
    selectedPosition,
    displayOffset,
    liChunBoundary,
    liChunProjection,
    liChun,
    liChunUnavailableMessage:liChun ? null : unavailableMessage(liChunBoundary),
    selectedCivilLiChunRelation,
    selectedLiChunRelation,
    liChunInstantResolution,
    selectedBeforeLiChun,
    liChunTransition,
    selectedYearPillar,
    nextDate:nextDate ? freeze({ ...nextDate }) : null,
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

  let targetInstant = null;
  try {
    targetInstant = readSelectedTargetInstant(instrument.dataset);
  } catch {
    targetInstant = null;
  }

  const state = researchYearStripState(selectedDate, { targetInstant });
  const baseMarker = document.querySelector("#research-year-base-marker");
  const liChunMarker = document.querySelector("#research-year-li-chun-marker");
  const liChunBand = document.querySelector("#research-year-li-chun-band");
  const liChunUnavailable = document.querySelector("#research-year-li-chun-unavailable");

  strip.dataset.ready = "true";
  strip.dataset.liChunBoundaryStatus = state.liChunBoundary.status;
  strip.dataset.liChunEpochStatus = state.liChunBoundary.epochStatus;
  strip.dataset.liChunProvider = state.liChunBoundary.providerId ?? "none";
  strip.dataset.liChunAuthorityClass = state.liChunBoundary.authorityClass ?? "none";
  strip.dataset.liChunProductionAuthority = state.liChunBoundary.productionAuthorityGranted === undefined
    ? "not-declared"
    : String(state.liChunBoundary.productionAuthorityGranted);
  strip.dataset.liChunIndependentTargetYearTruth = state.liChunBoundary.independentTargetYearTruth === undefined
    ? "not-declared"
    : String(state.liChunBoundary.independentTargetYearTruth);
  strip.dataset.liChunProjectionStatus = state.liChunProjection.status;
  strip.dataset.liChunPositionAvailable = String(Boolean(state.liChun));
  strip.dataset.liChunPositionStatus = state.liChun?.positionStatus ?? "unavailable";
  strip.dataset.liChunDisplayOffsetHoursFromUt1 = String(state.displayOffset.hours);
  strip.dataset.liChunDisplayOffsetSource = state.displayOffset.source;
  strip.dataset.selectedCivilLiChunRelation = state.selectedCivilLiChunRelation;
  strip.dataset.selectedLiChunRelation = state.selectedLiChunRelation;
  strip.dataset.liChunInstantResolution = state.liChunInstantResolution?.status ?? "not-needed";
  strip.dataset.liChunTargetBasis = state.liChunInstantResolution?.targetBasis ?? "none";
  strip.dataset.selectedBeforeLiChun = state.selectedBeforeLiChun === null ? "unknown" : String(state.selectedBeforeLiChun);
  strip.dataset.baseEdge = state.selectedPosition < 20 ? "start" : state.selectedPosition > 80 ? "end" : "none";
  strip.dataset.elapsedDays = state.elapsedDays === null ? "unavailable" : String(state.elapsedDays);
  strip.dataset.selectedYearPillar = state.selectedYearPillar?.name ?? "unavailable";
  strip.dataset.liChunYearPillarBefore = state.liChunTransition.before.name;
  strip.dataset.liChunYearPillarAfter = state.liChunTransition.after.name;

  if (baseMarker) baseMarker.style.setProperty("--year-x", `${state.selectedPosition.toFixed(4)}%`);
  setText(
    "research-year-strip-basis",
    `立春天文事件 · 顯示基準 ${offsetLabel(state.displayOffset.hours)} 固定時差`
  );
  setText(
    "research-year-base-title",
    state.selectedYearPillar
      ? `選定日 · ${state.selectedYearPillar.name}年`
      : ["boundary-day", "boundary-uncertain"].includes(state.selectedCivilLiChunRelation)
        ? state.liChunInstantResolution?.status === "target-instant-unbound"
          ? "選定日 · 立春日需時刻判定"
          : state.liChunInstantResolution?.status === "earth-rotation-uncertain"
            ? "選定日 · 立春區間內仍不確定"
            : "選定日 · 立春日仍待時間尺度"
        : "選定日 · 年柱待節氣判定"
  );
  setText("research-year-base-label", formatDate(state.selectedDate));
  setText("research-year-base-date", formatDate(state.selectedDate));

  if (state.liChun) {
    liChunMarker.hidden = false;
    liChunMarker.dataset.positionStatus = state.liChun.positionStatus;
    liChunMarker.style.setProperty("--year-x", `${state.liChun.position.toFixed(4)}%`);
    if (Number.isFinite(state.liChun.positionMin)) {
      liChunMarker.style.setProperty("--year-x-min", `${state.liChun.positionMin.toFixed(4)}%`);
    }
    if (Number.isFinite(state.liChun.positionMax)) {
      liChunMarker.style.setProperty("--year-x-max", `${state.liChun.positionMax.toFixed(4)}%`);
    }
    if (
      liChunBand
      && state.liChun.positionStatus === "estimated"
      && Number.isFinite(state.liChun.positionMin)
      && Number.isFinite(state.liChun.positionMax)
    ) {
      const left = Math.min(state.liChun.positionMin, state.liChun.positionMax);
      const right = Math.max(state.liChun.positionMin, state.liChun.positionMax);
      liChunBand.hidden = false;
      liChunBand.style.left = `${left.toFixed(4)}%`;
      liChunBand.style.width = `${Math.max(.12, right - left).toFixed(4)}%`;
    } else if (liChunBand) {
      liChunBand.hidden = true;
    }
    setText(
      "research-year-li-chun-title",
      `立春 · ${state.liChunTransition.before.name} → ${state.liChunTransition.after.name}`
    );
    setText(
      "research-year-li-chun-label",
      `${state.liChun.label} · ${offsetLabel(state.displayOffset.hours)} · ${seasonalAuthorityLabel(state.liChunBoundary)}`
    );
    liChunUnavailable.hidden = true;
  } else {
    liChunMarker.hidden = true;
    if (liChunBand) liChunBand.hidden = true;
    liChunUnavailable.hidden = false;
    setText(
      "research-year-li-chun-unavailable-title",
      `立春 · ${state.liChunTransition.before.name} → ${state.liChunTransition.after.name}`
    );
    setText("research-year-li-chun-unavailable-copy", state.liChunUnavailableMessage);
  }

  const elapsed = state.elapsedDays === null ? "—" : String(state.elapsedDays);
  setText("research-year-day-count", elapsed);
  setText("research-year-elapsed-days", elapsed);
  setText("research-year-next-date", state.nextDate ? formatDate(state.nextDate) : "下一年同月同日不存在");
}

if (strip && instrument) {
  const targetInstantAttributes = [
    "data-selected-target-instant-basis",
    "data-selected-target-instant-bound",
    "data-selected-target-instant-julian-day",
    "data-selected-target-instant-local-offset-hours-from-ut1"
  ];
  const observer = new MutationObserver(records => {
    if (records.some(record =>
      record.attributeName === "data-target-date"
      || targetInstantAttributes.includes(record.attributeName)
    )) render();
  });
  observer.observe(instrument, {
    attributes:true,
    attributeFilter:["data-target-date", ...targetInstantAttributes]
  });
  render();
}

export const RESEARCH_YEAR_STRIP_CONTRACT = freeze({
  id:"research-year-strip-seasonal-authority-v2",
  liChunLongitudeDegrees:LI_CHUN_LONGITUDE_DEGREES,
  defaultDisplayOffsetHoursFromUt1:DEFAULT_YEAR_STRIP_OFFSET_HOURS_FROM_UT1,
  transitionIndependentFromEpochAvailability:true,
  directLegacyCivilSolarTermAuthority:false
});
