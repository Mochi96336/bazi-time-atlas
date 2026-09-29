import {
  gregorianOrdinal,
  isGregorianLeapYear,
  recurrenceState,
  validateGregorianDate
} from "./recurrence/gregorian-cycle.js";
import { sexagenaryYearPillarForLiChunYear } from "./calendar/sexagenary-year.js";
import { shiftGregorianDate } from "./recurrence/gregorian-date-navigation.js";
import { jiaziAnchoredCivilYear, jiaziSelectedDayProgress } from "./recurrence/jiazi-year-geometry.js";
import { sexagenaryDayForGregorianDate } from "./recurrence/ganzhi-cycle-comparison.js";
import { resolveResearchSeasonalBoundary } from "./recurrence/research-seasonal-boundary-resolution.js";
import {
  RESEARCH_SEASONAL_EVIDENCE_READY_EVENT
} from "./recurrence/research-seasonal-chunk-prefetch.js";
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
      status:projection.status === "estimated"
        && targetInstant.basis !== TARGET_INSTANT_BASIS.TT_JULIAN_DAY
        ? "model-estimated"
        : "resolved",
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

function selectedYearMembership({
  relation,
  targetInstant,
  boundary,
  projection,
  instantResolution:resolution,
  beforeYearPillar,
  afterYearPillar
}) {
  if (relation !== "before" && relation !== "after") {
    return freeze({
      status:"unresolved",
      side:null,
      pillar:null,
      reason:relation === "boundary-uncertain"
        ? "boundary-uncertain"
        : boundary.epochStatus !== "resolved"
          ? "seasonal-epoch-unresolved"
          : "target-relation-unresolved"
    });
  }

  const pillar = relation === "before" ? beforeYearPillar : afterYearPillar;
  const sameScaleAuthoritativeComparison =
    boundary.authorityClass === "reviewed-production-direct-event"
    && boundary.timeScale === "TT"
    && targetInstant?.basis === TARGET_INSTANT_BASIS.TT_JULIAN_DAY
    && resolution?.status === "resolved";

  const deterministicAuthoritativeProjection =
    boundary.authorityClass === "reviewed-production-direct-event"
    && projection.status === "resolved"
    && projection.deterministicWithinModel === true;

  if (sameScaleAuthoritativeComparison || deterministicAuthoritativeProjection) {
    return freeze({
      status:"exact",
      side:relation,
      pillar,
      reason:sameScaleAuthoritativeComparison
        ? "authoritative-same-scale-comparison"
        : "authoritative-deterministic-projection"
    });
  }

  let reason = "model-dependent-boundary";
  if (boundary.authorityClass === "source-derived-research-evidence") {
    reason = "research-source-derived-boundary";
  } else if (projection.status === "estimated") {
    reason = "earth-rotation-model";
  } else if (boundary.authorityClass === "declared-model-direct-event") {
    reason = "seasonal-boundary-model";
  }

  return freeze({
    status:"model-estimated",
    side:relation,
    pillar,
    reason
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
  // Whole-calendar-year arithmetic is NOT the existing same-month/same-day
  // next-year dayDelta. A civil year always contains 365 or 366 days.
  const civilYearDays = isGregorianLeapYear(selectedDate.year) ? 366 : 365;
  const selectedDayPillar = sexagenaryDayForGregorianDate(selectedDate);
  const displayOffset = yearStripOffset(targetInstant);
  const liChunBoundary = resolveResearchSeasonalBoundary({
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
  const selectedLiChunRelation = ["resolved", "model-estimated"].includes(
    liChunInstantResolution?.status
  )
    ? liChunInstantResolution.side
    : selectedCivilLiChunRelation;
  const yearMembership = selectedYearMembership({
    relation:selectedLiChunRelation,
    targetInstant,
    boundary:liChunBoundary,
    projection:liChunProjection,
    instantResolution:liChunInstantResolution,
    beforeYearPillar,
    afterYearPillar
  });
  const selectedBeforeLiChun = yearMembership.side === "before"
    ? true
    : yearMembership.side === "after"
      ? false
      : null;
  const selectedYearPillar = yearMembership.pillar;

  return freeze({
    selectedDate:freeze({ ...selectedDate }),
    selectedPosition,
    selectedDayPillar,
    civilYearDays,
    civilYearFullDayCycles:Math.floor(civilYearDays/60),
    civilYearDayRemainder:civilYearDays%60,
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
    selectedYearMembership:yearMembership,
    selectedYearPillar,
    nextDate:nextDate ? freeze({ ...nextDate }) : null,
    elapsedDays:next.dayDelta
  });
}

function setText(id, value) {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = value;
}

function selectedYearForRender() {
  const selectedDate = parseDate(instrument?.dataset.targetDate);
  return selectedDate?.year ?? null;
}

function render() {
  if (!strip || !instrument) return;
  const selectedDate = parseDate(instrument.dataset.targetDate);
  if (!selectedDate) {
    strip.dataset.ready = "false";
    const scrub=document.querySelector("#research-year-scrub");
    if(scrub)scrub.disabled=true;
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
  const approximateLiChun = document.querySelector("#research-year-approx-li-chun");
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
  strip.dataset.liChunEvidenceTransport = state.liChunBoundary.event?.transport ?? "canonical-authority";
  strip.dataset.liChunPayloadIntegrityVerified = state.liChunBoundary.event?.payloadIntegrityVerified === undefined
    ? "not-applicable"
    : String(state.liChunBoundary.event.payloadIntegrityVerified);
  strip.dataset.liChunPayloadSha256 = state.liChunBoundary.event?.payloadSha256 ?? "none";
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
  strip.dataset.civilYearDays = String(state.civilYearDays);
  strip.dataset.civilYearDayRemainder = String(state.civilYearDayRemainder);
  const dayGeometry = jiaziAnchoredCivilYear(state.selectedDate.year);
  const jiaziLayer = document.getElementById("research-year-jiazi-ticks");
  strip.dataset.firstJiaziDate = formatDate(dayGeometry.ticks[0].date);
  strip.dataset.jiaziTickCount = String(dayGeometry.ticks.length);
  strip.dataset.inYearCompleteJiaziSpans = String(dayGeometry.completeInYearSpans);
  strip.dataset.jiaziHeadDays = String(dayGeometry.headDays);
  strip.dataset.jiaziTailDays = String(dayGeometry.tailDays);
  strip.dataset.newYearDayName = dayGeometry.nextJan1Pillar.name;
  if (jiaziLayer) {
    const nodes = document.createDocumentFragment();
    dayGeometry.ticks.forEach((item,index) => {
      const tick = document.createElement("span");
      tick.className = "research-year-jiazi-tick";
      tick.style.setProperty("--jiazi-x",item.percent.toFixed(5)+"%");
      tick.dataset.dayOffset = String(item.offset);
      tick.dataset.pillar = item.pillar;
      tick.dataset.first = String(index===0);
      tick.title = "甲子日 "+formatDate(item.date);
      const label = document.createElement("small");
      label.textContent = "甲子";
      tick.appendChild(label);
      nodes.appendChild(tick);
    });
    jiaziLayer.replaceChildren(nodes);
  }
  updateSelectedDayProgress(state.selectedDate);
  // The one visible slider follows the existing instrument's selected
  // target. It never creates or persists another selected-date state.
  const scrub=document.querySelector("#research-year-scrub");
  const hint=document.querySelector("#research-year-scrub-hint");
  if(scrub){
    const jan1=gregorianOrdinal({year:selectedDate.year,month:1,day:1});
    scrub.disabled=false;
    scrub.max=String(state.civilYearDays-1);
    scrub.value=String(gregorianOrdinal(selectedDate)-jan1);
    scrub.setAttribute("aria-valuetext",formatDate(selectedDate)+
      "，年柱 "+(state.selectedYearPillar?.name??"待判")+
      "，日柱 "+state.selectedDayPillar.name);
    scrub.dataset.targetYear=String(selectedDate.year);
    if(hint && strip.dataset.scrubStatus!=="preview")
      hint.textContent="拖動時間條選擇日期，放開後套用至原本的日期控制。";
  }
  strip.dataset.selectedDayPillar = state.selectedDayPillar.name;
  strip.dataset.selectedYearMembershipStatus = state.selectedYearMembership.status;
  strip.dataset.selectedYearMembershipReason = state.selectedYearMembership.reason;
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
      ? state.selectedYearMembership.status === "model-estimated"
        ? `選定日 · ${state.selectedYearPillar.name}年 · 模型估計`
        : `選定日 · ${state.selectedYearPillar.name}年`
      : ["boundary-day", "boundary-uncertain"].includes(state.selectedCivilLiChunRelation)
        ? state.liChunInstantResolution?.status === "target-instant-unbound"
          ? "選定日 · 立春日需時刻判定"
          : state.liChunInstantResolution?.status === "earth-rotation-uncertain"
            ? "選定日 · 立春區間內仍不確定"
            : "選定日 · 立春日仍待時間尺度"
        : "選定日 · 年柱待節氣判定"
  );
  setText("research-year-base-label", formatDate(state.selectedDate));
  setText("research-year-selected-date", formatDate(state.selectedDate));
  setText("research-year-selected-day", state.selectedDayPillar.name);
  const yearIsBoundary = ["boundary-day","boundary-uncertain"].includes(state.selectedCivilLiChunRelation);
  setText("research-year-selected-year",
    state.selectedYearPillar?.name ??
    (yearIsBoundary
      ? state.liChunTransition.before.name+"／"+state.liChunTransition.after.name
      : "尚待判定"));
  setText("research-year-selected-certainty",
    state.selectedYearMembership.status==="exact" ? "來源已判定" :
    state.selectedYearMembership.status==="model-estimated" ? "模型估計" :
    yearIsBoundary ? "需提供時刻" : "年界證據不足");
  setText("research-year-full-cycle",
    "走到明年元旦，日序走過 "+
    state.civilYearFullDayCycles+" 輪，再向前 "+state.civilYearDayRemainder+" 位。");
  setText("research-year-base-date", formatDate(state.selectedDate));

  if (state.liChun) {
    if (approximateLiChun) approximateLiChun.hidden = true;
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
    setText("research-year-transition",
      (state.liChun.positionStatus==="estimated" ? "約 " : "")+
      "立春 "+state.liChun.date.month+"/"+state.liChun.date.day+
      " · "+state.liChunTransition.before.name+" → "+state.liChunTransition.after.name);
    setText("research-year-transition-note",
      state.liChun.positionStatus==="estimated" ? "民用日期為模型估計" : "依現有立春來源定位");
  } else {
    // A soft early-Feb guide is visually distinguishable from an authoritative
    // event marker. It NEVER changes source coverage or Year resolution.
    if (approximateLiChun) {
      const start=positionForDate({year:state.selectedDate.year,month:2,day:2});
      const end=positionForDate({year:state.selectedDate.year,month:2,day:6});
      approximateLiChun.hidden=false;
      approximateLiChun.style.left=start.toFixed(4)+"%";
      approximateLiChun.style.width=(end-start).toFixed(4)+"%";
    }
    liChunMarker.hidden = true;
    if (liChunBand) liChunBand.hidden = true;
    liChunUnavailable.hidden = false;
    setText(
      "research-year-li-chun-unavailable-title",
      `立春 · ${state.liChunTransition.before.name} → ${state.liChunTransition.after.name}`
    );
    setText("research-year-li-chun-unavailable-copy", state.liChunUnavailableMessage);
    setText("research-year-transition",
      "約 2 月初立春 · "+state.liChunTransition.before.name+
      " → "+state.liChunTransition.after.name);
    setText("research-year-transition-note",state.liChunUnavailableMessage);
  }

  const elapsed = state.elapsedDays === null ? "—" : String(state.elapsedDays);
  setText("research-year-day-count", elapsed);
  setText("research-year-elapsed-days", elapsed);
  setText("research-year-next-date", state.nextDate ? formatDate(state.nextDate) : "下一年同月同日不存在");
  const track=document.querySelector(".research-year-track");
  if(track){
    track.dataset.liChunAvailable=String(Boolean(state.liChun));
    if(state.liChun)track.style.setProperty(
      "--li-chun-stop",state.liChun.position.toFixed(4)+"%");
    else track.style.removeProperty("--li-chun-stop");
    track.setAttribute("aria-label",
    state.selectedDate.year+" 公曆年；選定 "+formatDate(state.selectedDate)+
    "；年柱 "+(state.selectedYearPillar?.name??"未確認")+
    "，日柱 "+state.selectedDayPillar.name+"；"+
    (state.liChun
      ? "立春 "+state.liChun.date.month+"/"+state.liChun.date.day+
        "，"+state.liChunTransition.before.name+"轉"+state.liChunTransition.after.name
      : "本年立春位置證據不足")+"；"+
    state.civilYearDays+" 天＝6圈再多 "+state.civilYearDayRemainder+" 天");
  }
}

/** Only a thin highlight in the EXISTING Year line. This is a drawing
 * derived from the original target date, not a separate selection state.
 * For January dates whose previous 甲子 lies last year, clip the beginning
 * of the drawn highlight without lying about the day index.
 */
function updateSelectedDayProgress(date, {preview=false} = {}) {
  const part=jiaziSelectedDayProgress(date);
  const el=document.getElementById("research-year-day-progress");
  if (el) {
    el.style.left=part.leftPercent.toFixed(5)+"%";
    el.style.width=part.widthPercent.toFixed(5)+"%";
    el.dataset.preview=String(preview);
    el.dataset.dayIndex=String(part.dayIndex);
    el.dataset.dayOrdinal=String(part.dayOrdinal);
    el.dataset.previousJiaziOffset=String(part.previousJiaziOffset);
    el.dataset.anchorClipped=String(!part.anchorInYear);
    el.dataset.selectedOffset=String(part.selectedOffset);
  }
  document.querySelectorAll("#research-year-jiazi-ticks .research-year-jiazi-tick")
    .forEach(tick=>{
      tick.dataset.current=String(part.anchorInYear &&
        Number(tick.dataset.dayOffset)===part.previousJiaziOffset);
    });
}

function scrubPreview(event){
  const input=event.currentTarget;
  const target=parseDate(instrument?.dataset.targetDate);
  if(!target || input.disabled)return;
  const position=Number(input.value);
  if(!Number.isInteger(position) || position<0 ||
    position >= (isGregorianLeapYear(target.year)?366:365)) return;
  const preview=shiftGregorianDate({year:target.year,month:1,day:1},position);
  if(preview.year!==target.year)return;
  updateSelectedDayProgress(preview,{preview:true});
  const marker=document.querySelector("#research-year-base-marker");
  if(marker)marker.style.setProperty("--year-x",
    (position/(isGregorianLeapYear(target.year)?365:364)*100).toFixed(4)+"%");
  const hint=document.querySelector("#research-year-scrub-hint");
  if(hint)hint.textContent="預覽 "+formatDate(preview)+" · 放開套用";
  input.setAttribute("aria-valuetext","預覽 "+formatDate(preview)+"，放開後套用");
  strip.dataset.scrubStatus="preview";
}

function scrubCommit(event){
  const input=event.currentTarget;
  const selected=parseDate(instrument?.dataset.targetDate);
  if(!selected || input.disabled)return;
  const offset=Number(input.value);
  const length=isGregorianLeapYear(selected.year)?366:365;
  if(!Number.isInteger(offset)||offset<0||offset>=length){
    render();
    return;
  }
  const date=shiftGregorianDate({year:selected.year,month:1,day:1},offset);
  // The ORIGINAL recurrence view receives one intent and owns all commits,
  // including URL, base inputs, Δ, candidate states and the target data.
  window.dispatchEvent(new CustomEvent("recurrence:select-strip-date",{
    detail:{date,source:"original-year-strip"}
  }));
}

function scrubOutcome(event){
  const status=event.detail?.status??"invalid-request";
  strip.dataset.scrubStatus=status;
  render(); // also restores the ORIGINAL marker/slider when denied
  const feedback=document.querySelector("#research-year-scrub-feedback");
  if(!feedback)return;
  const messages={
    "stale-original-input":"基準日期或位移年數尚未套用，請先確認原本輸入。",
    "target-instant-bound":"已綁定精確時刻；請先使用原本的時刻控制修改或解除綁定。",
    "base-calendar-day-unavailable":"目前基準年份不能對應此日期（例如非閏年的 2/29）；保留原日期。",
    "cannot-preserve-delta":"此日期無法保持目前的位移年數；保留原日期。",
    "invalid-current-target":"原本的比較日期不存在，請先調整基準日期或位移。",
    "outside-current-target-year":"只能在目前選定的公曆年內拖動。",
    "invalid-date":"日期無效，原本的選定日期不變。",
    "invalid-request":"無法套用日期，原本的選定日期不變。"
  };
  feedback.hidden=status==="applied";
  feedback.textContent=messages[status]??"";
}

if (strip && instrument) {
  const nativeScrub=document.querySelector("#research-year-scrub");
  nativeScrub?.addEventListener("input",scrubPreview);
  nativeScrub?.addEventListener("change",scrubCommit);
  window.addEventListener("recurrence:strip-date-outcome",scrubOutcome);
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
  document.addEventListener(RESEARCH_SEASONAL_EVIDENCE_READY_EVENT, event => {
    if (event.detail?.year === selectedYearForRender()) render();
  });
  render();
}

export const RESEARCH_YEAR_STRIP_CONTRACT = freeze({
  id:"research-year-strip-seasonal-authority-v2",
  liChunLongitudeDegrees:LI_CHUN_LONGITUDE_DEGREES,
  defaultDisplayOffsetHoursFromUt1:DEFAULT_YEAR_STRIP_OFFSET_HOURS_FROM_UT1,
  transitionIndependentFromEpochAvailability:true,
  directLegacyCivilSolarTermAuthority:false,
  selectedYearMembershipStatuses:freeze(["exact", "model-estimated", "unresolved"]),
  oneSigmaIntervalIsHardDecisionBound:false,
  verifiedBinaryPrefetchEvent:RESEARCH_SEASONAL_EVIDENCE_READY_EVENT,
  rerendersWhenVerifiedBinaryEvidenceArrives:true
});
