import { baziMonths, solarTerms } from "../data.js";
import { resolveDayHourPillars } from "../calendar/tyme-adapter.js";
import { DEFAULT_ATLAS_TIME_CONTEXT } from "../wheel/atlas-time-context.js";
import { sexagenaryYearPillarForLiChunYear } from "../calendar/sexagenary-year.js";
import { monthPillarForYearStem } from "../calendar/five-tigers.js";
import { solveSolarLongitude } from "../astronomy/direct-seasonal-event-provider.js";
import { projectSeasonalBoundaryToCivil } from "../recurrence/seasonal-civil-projection.js";
import { researchGanzhiCycleComparison } from "../recurrence/ganzhi-cycle-comparison.js";
import {
  SEASONAL_DRIFT_26026_RESEARCH as SEASONAL_DATA,
  indexForLongitude,
  longitudeForIndex
} from "./seasonal-drift-26026-research-data.js";

export const RESEARCH_TIME_SELECTION_EVENT = "bazi-research-time-selection";
const seasonalStateCache = new Map();

export const RESEARCH_TIME_STATE_CONTRACT = Object.freeze({
  id:"research-time-state-v1",
  owners:Object.freeze(["discrete","seasonal"]),
  pillarStatuses:Object.freeze(["resolved","research-resolved","sequence-only","unresolved"]),
  deepTimeDayHourMayBeUnresolved:true,
  oneStateOwner:true
});

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

function termAtLongitude(longitudeDegrees) {
  const longitude = normalizeDegrees(longitudeDegrees);
  return solarTerms.find(term => term.longitude === longitude) ?? null;
}

function baziMonthAtLongitude(longitudeDegrees) {
  const month = baziMonths.find(item => rangeContains(item.start, item.end, longitudeDegrees));
  if (!month) throw new RangeError("longitude does not map to a BaZi month");
  return month;
}

/**
 * Direct seasonal-event providers use a catalogue that starts at the previous
 * December winter solstice: 270°..314° therefore still belongs to the BaZi
 * year that began at the previous Li Chun.
 */
export function activeLiChunYearForSeasonalLongitude(catalogueYear, longitudeDegrees) {
  if (!Number.isInteger(catalogueYear)) throw new RangeError("catalogueYear must be an integer");
  const longitude = normalizeDegrees(longitudeDegrees);
  return longitude >= 270 && longitude < 315 ? catalogueYear - 1 : catalogueYear;
}

function yearMonthPillarsAtLongitude(catalogueYear, longitudeDegrees, status) {
  const activeYear = activeLiChunYearForSeasonalLongitude(catalogueYear, longitudeDegrees);
  const year = sexagenaryYearPillarForLiChunYear(activeYear);
  const month = baziMonthAtLongitude(longitudeDegrees);
  const monthName = monthPillarForYearStem(year.stem, month.branch);
  return freeze({
    activeLiChunYear:activeYear,
    monthBranch:month.branch,
    monthStartTerm:month.startTerm,
    year:freeze({
      name:year.name,
      status,
      reason:"年柱由目前太陽黃經位於立春前／後的位置與 60 年序共同決定。"
    }),
    month:freeze({
      name:monthName,
      status,
      reason:`月柱由 ${month.startTerm} 起算的月支與年干五虎遁共同決定。`
    })
  });
}

function unresolvedPillar(reason) {
  return freeze({ name:null, status:"unresolved", reason });
}

function resolvedPillar(name, reason) {
  return freeze({ name, status:"resolved", reason });
}

function seasonalBoundary(ttJulianDay, providerId) {
  return freeze({
    epochStatus:"resolved",
    status:"research-seasonal-crossing",
    providerId,
    timeScale:"TT",
    ttJulianDay
  });
}

function integerClock(clock) {
  return freeze({
    year:clock.year,
    month:clock.month,
    day:clock.day,
    hour:clock.hour,
    minute:clock.minute,
    second:Math.max(0, Math.min(59, Math.floor(clock.second)))
  });
}

function baseSeasonalSide(longitudeDegrees) {
  const solved = solveSolarLongitude({
    year:SEASONAL_DATA.baseYear,
    longitudeDegrees
  });
  const projection = projectSeasonalBoundaryToCivil({
    year:SEASONAL_DATA.baseYear,
    boundary:seasonalBoundary(solved.ttJulianDay, solved.providerId),
    localOffsetHoursFromUt1:DEFAULT_ATLAS_TIME_CONTEXT.utcOffsetHours
  });
  if (projection.status !== "resolved" || !projection.localClockResolved) {
    throw new Error("modern seasonal crossing did not resolve to the canonical local clock");
  }
  const clock = integerClock(projection.localClock);
  const dayHour = resolveDayHourPillars(clock, {
    dayBoundary:DEFAULT_ATLAS_TIME_CONTEXT.dayBoundary,
    timeBasis:"fixed-zone-from-ut1"
  });
  const yearMonth = yearMonthPillarsAtLongitude(
    SEASONAL_DATA.baseYear,
    longitudeDegrees,
    "resolved"
  );
  return freeze({
    catalogueYear:SEASONAL_DATA.baseYear,
    coordinate:freeze({
      timeScale:"TT",
      ttJulianDay:solved.ttJulianDay,
      localClock:clock,
      localClockStatus:"resolved",
      localOffsetHoursFromUt1:DEFAULT_ATLAS_TIME_CONTEXT.utcOffsetHours
    }),
    pillars:freeze({
      year:yearMonth.year,
      month:yearMonth.month,
      day:resolvedPillar(dayHour.pillars.day.name, "2026 crossing 已確定投影到目前主頁相同的地方鐘面與日界規則。"),
      hour:resolvedPillar(dayHour.pillars.hour.name, "2026 crossing 已確定投影到目前主頁相同的地方鐘面與時柱規則。")
    }),
    activeLiChunYear:yearMonth.activeLiChunYear,
    monthBranch:yearMonth.monthBranch
  });
}

function targetSeasonalSide(longitudeDegrees, ttJulianDay) {
  const projection = projectSeasonalBoundaryToCivil({
    year:SEASONAL_DATA.targetYear,
    boundary:seasonalBoundary(ttJulianDay, SEASONAL_DATA.provenance.timeline.providerId ?? "rebound-26026-full-seasonal-timeline"),
    localOffsetHoursFromUt1:DEFAULT_ATLAS_TIME_CONTEXT.utcOffsetHours
  });
  const yearMonth = yearMonthPillarsAtLongitude(
    SEASONAL_DATA.targetYear,
    longitudeDegrees,
    "research-resolved"
  );
  const uncertaintyDays = Number.isFinite(projection.uncertaintySeconds)
    ? projection.uncertaintySeconds / 86400
    : null;
  return freeze({
    catalogueYear:SEASONAL_DATA.targetYear,
    coordinate:freeze({
      timeScale:"TT",
      ttJulianDay,
      localClock:projection.pointEstimateAvailable ? projection.localClock : null,
      localClockStatus:projection.status,
      localOffsetHoursFromUt1:DEFAULT_ATLAS_TIME_CONTEXT.utcOffsetHours,
      uncertaintyDays
    }),
    pillars:freeze({
      year:yearMonth.year,
      month:yearMonth.month,
      day:unresolvedPillar("26026 的 TT crossing 尚無可唯一決定民用日相位的 Earth-rotation / civil-time bridge。"),
      hour:unresolvedPillar("時柱還需要已解析日干與唯一地方鐘面；深時間 UT1 目前只有帶不確定性的估計。")
    }),
    activeLiChunYear:yearMonth.activeLiChunYear,
    monthBranch:yearMonth.monthBranch
  });
}

export function researchSeasonalTimeState(longitudeDegrees) {
  const index = indexForLongitude(longitudeDegrees);
  if (seasonalStateCache.has(index)) return seasonalStateCache.get(index);
  const longitude = longitudeForIndex(index);
  const driftDays = SEASONAL_DATA.driftDays[index];
  const base = baseSeasonalSide(longitude);
  const spanDays = SEASONAL_DATA.gregorianDaySpanDays;
  if (!Number.isFinite(spanDays)) {
    throw new Error("seasonal research data is missing gregorianDaySpanDays");
  }
  const targetTtJulianDay = base.coordinate.ttJulianDay + spanDays + driftDays;
  const target = targetSeasonalSide(longitude, targetTtJulianDay);
  const term = termAtLongitude(longitude);
  const month = baziMonthAtLongitude(longitude);

  const state = freeze({
    contract:RESEARCH_TIME_STATE_CONTRACT.id,
    owner:"seasonal",
    selection:freeze({
      longitudeDegrees:longitude,
      index,
      termName:term?.name ?? null,
      termKind:term?.kind ?? null,
      baziMonthBranch:month.branch,
      baziMonthStartTerm:month.startTerm
    }),
    comparison:freeze({
      baseYear:SEASONAL_DATA.baseYear,
      targetYear:SEASONAL_DATA.targetYear,
      deltaYears:SEASONAL_DATA.targetYear - SEASONAL_DATA.baseYear,
      driftDays
    }),
    base,
    target
  });
  seasonalStateCache.set(index,state);
  return state;
}

function sequencePillar(name, reason) {
  return freeze({ name, status:"sequence-only", reason });
}

export function researchDiscreteDateState(baseDate, deltaYears) {
  const comparison = researchGanzhiCycleComparison(baseDate, deltaYears);
  const target = comparison.target;
  return freeze({
    contract:RESEARCH_TIME_STATE_CONTRACT.id,
    owner:"discrete",
    selection:freeze({
      dateOnly:true,
      baseDate:comparison.base.date,
      targetDate:target?.date ?? null
    }),
    comparison:freeze({
      deltaYears,
      yearPhaseClosed:comparison.yearPhaseClosed,
      dayPhaseClosed:comparison.dayPhaseClosed
    }),
    base:freeze({
      coordinate:freeze({ timeScale:"date-only", localClockStatus:"unbound" }),
      pillars:freeze({
        year:sequencePillar(comparison.base.year.name, "01 目前只比較名義 60 年序；真正年柱仍要看立春側。"),
        month:unresolvedPillar("日期層尚未綁定太陽黃經／節界位置。"),
        day:sequencePillar(comparison.base.day.name, "依 proleptic Gregorian 整數日數延伸的 60 日序。"),
        hour:unresolvedPillar("日期層尚未指定日內時刻。")
      })
    }),
    target:target ? freeze({
      coordinate:freeze({ timeScale:"date-only", localClockStatus:"unbound" }),
      pillars:freeze({
        year:sequencePillar(target.year.name, "01 目前只比較名義 60 年序；真正年柱仍要看立春側。"),
        month:unresolvedPillar("日期層尚未綁定太陽黃經／節界位置。"),
        day:sequencePillar(target.day.name, "依 proleptic Gregorian 整數日數延伸的 60 日序。"),
        hour:unresolvedPillar("日期層尚未指定日內時刻。")
      })
    }) : null
  });
}

export function publishResearchTimeSelection(detail) {
  if (typeof document === "undefined") return false;
  document.dispatchEvent(new CustomEvent(RESEARCH_TIME_SELECTION_EVENT, {
    detail
  }));
  return true;
}