import { gregorianOrdinal, recurrenceState, validateGregorianDate } from "./gregorian-cycle.js";
import { sexagenaryYearPillarForLiChunYear } from "../calendar/sexagenary-year.js";
import { resolveDayHourPillars, DAY_BOUNDARY } from "../calendar/tyme-adapter.js";
import { cycleItem, sexagenaryCycle } from "../sexagenary-data.js";

// One reviewed modern calendar-day anchor. The date-only research view reads it
// at local noon, where both supported day-boundary conventions agree. Extend
// the DISCRETE sequence by proleptic-Gregorian integer day count; this does not
// claim an ancient/future timezone, physical instant or full BaZi birth pillar.
const ANCHOR_DATE = Object.freeze({ year:2026, month:9, day:13 });
const ANCHOR_NAME = resolveDayHourPillars(
  { ...ANCHOR_DATE, hour:12, minute:0, second:0 },
  { dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT }
).pillars.day.name;
const ANCHOR_INDEX = sexagenaryCycle.findIndex(item => item.name === ANCHOR_NAME);
if (ANCHOR_INDEX < 0) throw new Error("The modern day-cycle anchor is not in the canonical 60-day sequence");
const ANCHOR_ORDINAL = gregorianOrdinal(ANCHOR_DATE);

export const RESEARCH_GANZHI_DAY_ANCHOR = Object.freeze({
  ...ANCHOR_DATE,
  pillar:ANCHOR_NAME,
  cycleIndex:ANCHOR_INDEX,
  referenceClock:"local-noon",
  calendar:"proleptic-gregorian"
});

function asPillar(item) {
  return Object.freeze({
    name:item.name, index:item.index, ordinal:item.ordinal,
    stem:item.stem.name, branch:item.branch.name
  });
}

export function sexagenaryDayForGregorianDate(date) {
  if (!validateGregorianDate(date)) throw new RangeError("invalid research Gregorian day");
  return asPillar(cycleItem(ANCHOR_INDEX + gregorianOrdinal(date) - ANCHOR_ORDINAL));
}

// A nominal 60-year sequence label, NOT an assertion that the selected civil
// day has crossed its astronomical Li Chun boundary. The Year Strip independently
// resolves the active pillar where boundary evidence is available.
export function nominalSexagenaryYearForGregorianDate(date) {
  if (!validateGregorianDate(date)) throw new RangeError("invalid research Gregorian date");
  const year = sexagenaryYearPillarForLiChunYear(date.year);
  return Object.freeze({ ...year, ordinal:year.cycleIndex + 1 });
}

export function researchGanzhiCycleComparison(baseDate, deltaYears) {
  const recurrence = recurrenceState(baseDate, deltaYears);
  const base = Object.freeze({
    date:recurrence.baseDate,
    year:nominalSexagenaryYearForGregorianDate(recurrence.baseDate),
    day:sexagenaryDayForGregorianDate(recurrence.baseDate)
  });
  const target = recurrence.targetValid
    ? Object.freeze({
      date:recurrence.targetDate,
      year:nominalSexagenaryYearForGregorianDate(recurrence.targetDate),
      day:sexagenaryDayForGregorianDate(recurrence.targetDate)
    })
    : null;
  const mod60 = value => ((value % 60) + 60) % 60;
  if (target && (
    mod60(target.year.cycleIndex - base.year.cycleIndex) !== recurrence.phases.yearSequence ||
    mod60(target.day.index - base.day.index) !== recurrence.phases.day
  )) {
    throw new Error("absolute Ganzhi identities diverged from the shared discrete recurrence phases");
  }
  return Object.freeze({
    base, target, recurrence,
    yearPhase:recurrence.phases.yearSequence,
    dayPhase:recurrence.phases.day,
    actualDaysElapsed:recurrence.dayDelta,
    yearPhaseClosed:recurrence.closed.yearSequence,
    dayPhaseClosed:recurrence.closed.day,
    dayConvention:"proleptic-gregorian-local-noon-discrete-sequence",
    yearConvention:"nominal-li-chun-after-year-label"
  });
}
